/**
 * GET  /api/admin/payout-confirm?reportId=xxx  → 컨펌 화면용 상세 내역
 * POST /api/admin/payout-confirm               → 컨펌(회원 공개) / 컨펌 해제
 *
 * 수당은 계산·저장되어도 status='confirmed' 가 되기 전에는 회원에게 보이지 않는다.
 * 이 라우트가 그 게이트다.
 *
 * POST body: { reportId: string, action: 'confirm' | 'unconfirm' }
 *   confirm   : pending → confirmed (회원 공개)
 *   unconfirm : confirmed → pending (다시 숨김. 이미 paid 면 거부)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, clientIp, tooMany } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function adminUser(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  if (!token) return null
  const { data } = await admin.auth.getUser(token)
  return data.user?.app_metadata?.role === 'admin' ? data.user : null
}

/**
 * 이 보고서의 지급 대상을 계정 단위로 집계.
 * 송금은 계정당 1건이므로 컨펌 스냅샷·Binance 시트 모두 이 기준을 쓴다.
 */
export type PayableAccount = {
  accountId: string; profileId: string; name: string; nodeIds: string[]
  address: string | null; amount: number
}

/** payout_distributions 는 1000행 제한이 있어 전부 받으려면 페이지네이션 필수 */
async function fetchAllDistributions(reportId: string) {
  const rows: { recipient_id: string; bonus_type: string; amount: number }[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('payout_distributions')
      .select('recipient_id, bonus_type, amount')
      .eq('report_id', reportId)
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

/** 보고서의 지급 대상을 계정 단위로 집계 (송금 1건 = 계정 1개) */
export async function buildPayableAccounts(reportId: string): Promise<PayableAccount[]> {
  const dists = await fetchAllDistributions(reportId)
  if (!dists.length) return []

  const byNode = new Map<string, number>()
  for (const d of dists) byNode.set(d.recipient_id, (byNode.get(d.recipient_id) ?? 0) + d.amount)

  const nodeIds = [...byNode.keys()]
  const { data: profs } = await admin
    .from('profiles')
    .select('id, node_id, name, owner_id, trc20_address')
    .in('id', nodeIds)
  const pMap = new Map((profs ?? []).map(p => [p.id, p]))

  const acc = new Map<string, PayableAccount>()
  for (const id of nodeIds) {
    const p = pMap.get(id)
    const accountId = p?.owner_id ?? id
    const cur: PayableAccount = acc.get(accountId) ?? {
      accountId, profileId: id, name: p?.name ?? '(알 수 없음)',
      nodeIds: [], address: null, amount: 0,
    }
    cur.nodeIds.push(p?.node_id ?? '—')
    cur.amount += byNode.get(id) ?? 0
    if (!cur.address && p?.trc20_address) cur.address = p.trc20_address
    acc.set(accountId, cur)
  }
  for (const a of acc.values()) a.nodeIds.sort()
  return [...acc.values()].sort((x, y) => y.amount - x.amount)
}

export async function GET(req: NextRequest) {
  try {
    if (!await adminUser(req)) return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
    const reportId = req.nextUrl.searchParams.get('reportId')
    if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 })

    const { data: report } = await admin
      .from('profit_reports')
      .select('id, date_from, date_to, status, total_unpaid')
      .eq('id', reportId)
      .maybeSingle()
    if (!report) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 })

    const dists = await fetchAllDistributions(reportId)

    // 수령 노드별 합계
    const byNode = new Map<string, { referral: number; rank: number; sponsor: number; total: number }>()
    for (const d of dists) {
      const cur = byNode.get(d.recipient_id) ?? { referral: 0, rank: 0, sponsor: 0, total: 0 }
      if (d.bonus_type === 'referral') cur.referral += d.amount
      else if (d.bonus_type === 'rank') cur.rank += d.amount
      else if (d.bonus_type === 'sponsor') cur.sponsor += d.amount
      cur.total += d.amount
      byNode.set(d.recipient_id, cur)
    }

    // 노드 정보 + 계정 귀속(송금은 계정 단위라 계정별로도 묶어 보여준다)
    const nodeIds = [...byNode.keys()]
    const profileMap = new Map<string, { node_id: string; name: string; rank: string; owner_id: string | null; trc20: string | null }>()
    if (nodeIds.length) {
      const { data: profs } = await admin
        .from('profiles')
        .select('id, node_id, name, rank, owner_id, trc20_address')
        .in('id', nodeIds)
      for (const p of (profs ?? [])) {
        profileMap.set(p.id, { node_id: p.node_id, name: p.name, rank: p.rank, owner_id: p.owner_id, trc20: p.trc20_address })
      }
    }

    const nodes = nodeIds.map(id => {
      const p = profileMap.get(id)
      const s = byNode.get(id)!
      // 주의: s 에도 rank(직급수당 금액)가 있어 프로필 직급과 이름이 겹친다.
      // 직급은 nodeRank 로 분리해 덮어쓰기를 막는다.
      return {
        profileId: id,
        nodeId:   p?.node_id ?? '—',
        name:     p?.name ?? '(알 수 없음)',
        nodeRank: p?.rank ?? '—',
        accountId: p?.owner_id ?? id,
        trc20:    p?.trc20 ?? null,
        ...s,
      }
    }).sort((a, b) => b.total - a.total)

    // 계정별 합산 — 실제 송금 단위
    const accMap = new Map<string, { accountId: string; name: string; trc20: string | null; nodeIds: string[]; referral: number; rank: number; sponsor: number; total: number }>()
    for (const n of nodes) {
      const cur = accMap.get(n.accountId) ?? {
        accountId: n.accountId, name: n.name, trc20: n.trc20,
        nodeIds: [], referral: 0, rank: 0, sponsor: 0, total: 0,
      }
      cur.nodeIds.push(n.nodeId)
      cur.referral += n.referral; cur.rank += n.rank; cur.sponsor += n.sponsor; cur.total += n.total
      if (!cur.trc20 && n.trc20) cur.trc20 = n.trc20
      accMap.set(n.accountId, cur)
    }
    const accounts = [...accMap.values()].sort((a, b) => b.total - a.total)

    const totals = nodes.reduce((s, n) => ({
      referral: s.referral + n.referral, rank: s.rank + n.rank,
      sponsor: s.sponsor + n.sponsor, total: s.total + n.total,
    }), { referral: 0, rank: 0, sponsor: 0, total: 0 })

    // 낙전(지급되지 않고 회사 귀속된 몫)도 함께 보여줘야 총액이 맞는지 검증 가능
    const { data: forf } = await admin
      .from('forfeited_bonuses')
      .select('amount, reason')
      .eq('report_id', reportId)
    const forfeited = (forf ?? []).reduce((s, f) => s + f.amount, 0)

    return NextResponse.json({
      report,
      isConfirmed: report.status === 'confirmed' || report.status === 'paid',
      hasCalc: dists.length > 0,
      totals, forfeited,
      rowCount: dists.length,
      accounts, nodes,
      // 송금 대상인데 지갑주소가 없는 계정 — 컨펌 전에 반드시 확인해야 함
      missingWallet: accounts.filter(a => !a.trc20).map(a => ({ name: a.name, nodeIds: a.nodeIds, total: a.total })),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '조회 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await adminUser(req)
    if (!actor) return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
    if (!await rateLimit(`payout-confirm:${clientIp(req)}`, 30, 60)) {
      return NextResponse.json(tooMany, { status: 429 })
    }

    const { reportId, action } = await req.json().catch(() => ({}))
    if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 })
    if (action !== 'confirm' && action !== 'unconfirm') {
      return NextResponse.json({ error: 'action 은 confirm 또는 unconfirm' }, { status: 400 })
    }

    const { data: report } = await admin
      .from('profit_reports')
      .select('id, status, date_from')
      .eq('id', reportId)
      .maybeSingle()
    if (!report) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 })

    if (action === 'confirm') {
      // 계산이 저장되지 않은 보고서를 컨펌하면 회원에게 "0원"이 공개된다 → 차단
      const dists = await fetchAllDistributions(reportId)
      if (dists.length === 0) {
        return NextResponse.json(
          { error: '수당 계산 결과가 없습니다. 먼저 수당 계산을 실행하고 저장해주세요.' },
          { status: 409 },
        )
      }
      if (report.status === 'paid') {
        return NextResponse.json({ error: '이미 지급 완료된 보고서입니다.' }, { status: 409 })
      }

      const { error } = await admin.from('profit_reports').update({ status: 'confirmed' }).eq('id', reportId)
      if (error) throw error

      // 지급 대상 스냅샷 — 컨펌 시점의 "누구에게 얼마" 를 고정한다.
      // 이후 데이터가 바뀌어도 송금·대사는 이 스냅샷 기준으로 movement 하도록.
      // 테이블이 아직 없더라도(마이그레이션 미실행) 컨펌 자체는 막지 않는다.
      try {
        const payables = await buildPayableAccounts(reportId)
        if (payables.length) {
          await admin.from('payout_transfers').delete().eq('report_id', reportId)
          await admin.from('payout_transfers').insert(payables.map(p => ({
            report_id:  reportId,
            account_id: p.accountId,
            profile_id: p.profileId,
            name:       p.name,
            node_ids:   p.nodeIds.join(', '),
            address:    p.address,
            amount:     Math.round(p.amount * 100) / 100,
            status:     p.address ? 'pending' : 'no_wallet',
          })))
        }
      } catch (e) {
        console.error('[payout_transfers snapshot]', e)
      }

      const total = dists.reduce((s, d) => s + d.amount, 0)
      await logAudit({
        actorId: actor.id, actorEmail: actor.email, action: 'payout_confirm',
        targetType: 'report', targetId: reportId,
        detail: { month: String(report.date_from).slice(0, 7), rows: dists.length, total },
      })
      return NextResponse.json({ ok: true, status: 'confirmed', rows: dists.length, total })
    }

    // unconfirm — 이미 송금까지 끝난 건 되돌리지 않는다
    if (report.status === 'paid') {
      return NextResponse.json({ error: '지급 완료된 보고서는 컨펌을 해제할 수 없습니다.' }, { status: 409 })
    }
    const { error } = await admin.from('profit_reports').update({ status: 'pending' }).eq('id', reportId)
    if (error) throw error

    await logAudit({
      actorId: actor.id, actorEmail: actor.email, action: 'payout_unconfirm',
      targetType: 'report', targetId: reportId,
      detail: { month: String(report.date_from).slice(0, 7) },
    })
    return NextResponse.json({ ok: true, status: 'pending' })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '처리 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
