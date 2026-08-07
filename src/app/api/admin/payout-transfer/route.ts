/**
 * GET  /api/admin/payout-transfer?reportId=xxx  → 이 보고서의 송금 내역(계정별)
 * POST /api/admin/payout-transfer               → Binance 결과 CSV 반영
 *
 * 왜 계정 단위인가:
 *   엑셀 정산은 "보고서 1개 = 그 달 회원 전체" 라서, 송금 결과를 보고서 상태 하나로
 *   뭉뚱그리면 누가 받고 누가 못 받았는지 남지 않는다. 그래서 컨펌 시점에 계정별
 *   지급 대상을 payout_transfers 에 스냅샷으로 남기고, 결과를 주소로 매칭해 개별 기록한다.
 *
 * POST body: { reportId, rows: [{ address, status:'success'|'failed', reason?, amount? }] }
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

type Transfer = {
  id: string; account_id: string; name: string | null; node_ids: string | null
  address: string | null; amount: number; status: string; reason: string | null
  applied_at: string | null
}

export async function GET(req: NextRequest) {
  try {
    if (!await adminUser(req)) return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
    const reportId = req.nextUrl.searchParams.get('reportId')
    if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 })

    const { data, error } = await admin
      .from('payout_transfers')
      .select('id, account_id, name, node_ids, address, amount, status, reason, applied_at')
      .eq('report_id', reportId)
      .order('amount', { ascending: false })
    if (error) {
      // 마이그레이션 전이면 조용히 빈 목록 — 화면이 깨지지 않도록
      return NextResponse.json({ transfers: [], summary: null, available: false })
    }

    const transfers = (data ?? []) as Transfer[]
    const sum = (st: string) => transfers.filter(t => t.status === st)
    const summary = {
      total:     transfers.length,
      pending:   sum('pending').length,
      success:   sum('success').length,
      failed:    sum('failed').length,
      noWallet:  sum('no_wallet').length,
      amountTotal:   transfers.reduce((s, t) => s + Number(t.amount), 0),
      amountSuccess: sum('success').reduce((s, t) => s + Number(t.amount), 0),
      amountFailed:  sum('failed').reduce((s, t) => s + Number(t.amount), 0),
      amountPending: sum('pending').reduce((s, t) => s + Number(t.amount), 0),
      amountNoWallet: sum('no_wallet').reduce((s, t) => s + Number(t.amount), 0),
    }
    return NextResponse.json({ transfers, summary, available: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '조회 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await adminUser(req)
    if (!actor) return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
    if (!await rateLimit(`payout-transfer:${clientIp(req)}`, 20, 60)) {
      return NextResponse.json(tooMany, { status: 429 })
    }

    const { reportId, rows } = await req.json().catch(() => ({}))
    if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 })
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: '결과 행이 없습니다.' }, { status: 400 })
    }

    const { data: existing, error: exErr } = await admin
      .from('payout_transfers')
      .select('id, account_id, address, amount, status')
      .eq('report_id', reportId)
    if (exErr) {
      return NextResponse.json(
        { error: '송금 내역 테이블이 없습니다. payout_transfers 마이그레이션을 먼저 실행해주세요.' },
        { status: 409 },
      )
    }
    if (!existing?.length) {
      return NextResponse.json(
        { error: '이 보고서의 지급 대상 스냅샷이 없습니다. 먼저 지급 컨펌을 진행해주세요.' },
        { status: 409 },
      )
    }

    // 주소로 매칭 (대소문자 무시)
    const byAddr = new Map<string, typeof existing[0]>()
    for (const t of existing) if (t.address) byAddr.set(t.address.toLowerCase(), t)

    const now = new Date().toISOString()
    let matched = 0, success = 0, failed = 0
    const unmatched: string[] = []

    for (const r of rows) {
      const addr = String(r.address ?? '').trim().toLowerCase()
      if (!addr) continue
      const t = byAddr.get(addr)
      if (!t) { unmatched.push(String(r.address ?? '')); continue }

      const ok = r.status === 'success'
      const { error } = await admin.from('payout_transfers').update({
        status: ok ? 'success' : 'failed',
        reason: ok ? null : (typeof r.reason === 'string' ? r.reason : '실패'),
        applied_at: now,
      }).eq('id', t.id)
      if (error) throw error
      matched++
      if (ok) success++; else failed++
    }

    // 보고서 상태 — 전원 성공일 때만 paid. 하나라도 실패면 failed(재처리 필요)
    const { data: after } = await admin
      .from('payout_transfers')
      .select('status')
      .eq('report_id', reportId)
    const list = after ?? []
    const anyFailed  = list.some(t => t.status === 'failed')
    const anyPending = list.some(t => t.status === 'pending')
    const nextStatus = anyFailed ? 'failed' : anyPending ? 'confirmed' : 'paid'
    await admin.from('profit_reports').update({ status: nextStatus }).eq('id', reportId)

    await logAudit({
      actorId: actor.id, actorEmail: actor.email, action: 'payout_transfer_apply',
      targetType: 'report', targetId: reportId,
      detail: { matched, success, failed, unmatched: unmatched.length, reportStatus: nextStatus },
    })

    return NextResponse.json({
      ok: true, matched, success, failed,
      unmatched, reportStatus: nextStatus,
      // 아직 결과가 안 들어온 건 — 부분 반영일 때 남은 걸 알려준다
      stillPending: list.filter(t => t.status === 'pending').length,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '반영 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
