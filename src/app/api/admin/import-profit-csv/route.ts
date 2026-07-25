/**
 * POST /api/admin/import-profit-csv
 *
 * 월간 ProfitShareReview CSV → 회원별 PF(sharedProfit) → 활성 노드에 PF/N 분배
 * → profit_report + profit_report_items 생성. payout-calc 의 입력이 된다.
 *
 * 인증: 관리자 토큰.
 * body: { csv: string, apply?: boolean }
 *   apply=false(기본) → 미리보기(생성 안 함), true → 실제 생성.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseProfitShareCsv, aggregateByCt, splitEven, parsePeriod } from '@/lib/profit-csv'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  if (!token) return false
  const { data } = await admin.auth.getUser(token)
  return data.user?.app_metadata?.role === 'admin'
}

export async function POST(req: NextRequest) {
  try {
    if (!await isAdmin(req)) return NextResponse.json({ error: '관리자 권한 필요' }, { status: 401 })

    const { csv, apply = false } = await req.json()
    if (!csv || typeof csv !== 'string') return NextResponse.json({ error: 'csv 필요' }, { status: 400 })

    const rows = parseProfitShareCsv(csv)
    if (rows.length === 0) return NextResponse.json({ error: 'CSV 파싱 실패(형식 확인)' }, { status: 422 })
    const byCt = aggregateByCt(rows)

    // 기간 (첫 유효 행 기준)
    const periodRaw = rows.find(r => r.period)?.period ?? ''
    const period = parsePeriod(periodRaw)
    if (!period) return NextResponse.json({ error: '정산 기간을 CSV에서 읽지 못했습니다.' }, { status: 422 })

    // 계정 매핑 + 노드 로드
    const { data: accounts } = await admin.from('member_accounts').select('user_id, vantage_ct')
    const ctToUser = new Map((accounts ?? []).map(a => [String(a.vantage_ct), a.user_id]))

    const { data: profiles } = await admin
      .from('profiles')
      .select('id, node_id, name, owner_id, status, trc20_address, mt5_account_id')
    const activeByOwner = new Map<string, { id: string; node_id: string; name: string; trc20_address: string | null }[]>()
    for (const p of (profiles ?? [])) {
      if (p.status !== 'active' || !p.owner_id) continue
      if (!activeByOwner.has(p.owner_id)) activeByOwner.set(p.owner_id, [])
      activeByOwner.get(p.owner_id)!.push(p)
    }

    type ItemRow = {
      mt5_account_id: string; strategy_name: string; distributable_income: number
      profit_ratio: number; unpaid_profit: number
      matched_profile_id: string; matched_node_id: string; matched_name: string
      trc20_address: string | null
    }
    const items: ItemRow[] = []
    const breakdown: { vantageCt: string; name: string; pf: number; nodes: number; perNode: number[]; status: string }[] = []
    let totalUnpaid = 0

    for (const [ct, agg] of byCt) {
      const pf = Math.round(agg.sharedProfit * 100) / 100
      const userId = ctToUser.get(ct)
      if (!userId) { breakdown.push({ vantageCt: ct, name: agg.name, pf, nodes: 0, perNode: [], status: 'unmatched' }); continue }
      if (pf <= 0) { breakdown.push({ vantageCt: ct, name: agg.name, pf, nodes: 0, perNode: [], status: 'loss_or_zero' }); continue }

      const nodes = (activeByOwner.get(userId) ?? []).slice().sort((a, b) => a.node_id.localeCompare(b.node_id))
      if (nodes.length === 0) { breakdown.push({ vantageCt: ct, name: agg.name, pf, nodes: 0, perNode: [], status: 'no_active_node' }); continue }

      const shares = splitEven(pf, nodes.length)
      const netShares = splitEven(Math.round(agg.netProfit * 100) / 100, nodes.length)
      nodes.forEach((node, i) => {
        items.push({
          mt5_account_id: ct,
          strategy_name: 'CopyTrade',
          distributable_income: netShares[i],
          profit_ratio: agg.pct || 0.5,
          unpaid_profit: shares[i],
          matched_profile_id: node.id,
          matched_node_id: node.node_id,
          matched_name: node.name,
          trc20_address: node.trc20_address,
        })
        totalUnpaid += shares[i]
      })
      breakdown.push({ vantageCt: ct, name: agg.name, pf, nodes: nodes.length, perNode: shares, status: 'ok' })
    }

    totalUnpaid = Math.round(totalUnpaid * 100) / 100

    const summary = {
      applied: apply,
      period,
      accounts: byCt.size,
      matched: breakdown.filter(b => b.status === 'ok').length,
      unmatched: breakdown.filter(b => b.status === 'unmatched').length,
      lossOrZero: breakdown.filter(b => b.status === 'loss_or_zero').length,
      noActiveNode: breakdown.filter(b => b.status === 'no_active_node').length,
      items: items.length,
      totalUnpaid,
    }

    if (!apply) {
      return NextResponse.json({ summary, breakdown })
    }

    // 실제 생성: 같은 기간 기존 보고서 정리 후 재생성
    const { data: existing } = await admin.from('profit_reports').select('id').eq('date_from', period.from)
    for (const r of (existing ?? [])) {
      await admin.from('payout_distributions').delete().eq('report_id', r.id)
      await admin.from('forfeited_bonuses').delete().eq('report_id', r.id)
      await admin.from('profit_report_items').delete().eq('report_id', r.id)
      await admin.from('profit_reports').delete().eq('id', r.id)
    }

    const { data: report, error: repErr } = await admin.from('profit_reports').insert({
      date_from: period.from, date_to: period.to, total_unpaid: totalUnpaid,
      status: 'pending', uploaded_at: new Date().toISOString(),
    }).select('id').single()
    if (repErr) throw new Error(repErr.message)

    const withReport = items.map(it => ({ ...it, report_id: report.id }))
    for (let i = 0; i < withReport.length; i += 200) {
      const { error } = await admin.from('profit_report_items').insert(withReport.slice(i, i + 200))
      if (error) throw new Error(error.message)
    }

    return NextResponse.json({ summary, breakdown, reportId: report.id })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '임포트 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
