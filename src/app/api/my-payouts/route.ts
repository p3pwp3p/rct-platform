/**
 * GET /api/my-payouts?profileId=xxx
 *
 * 특정 프로필이 수령한 수당 내역 반환.
 * payout_distributions 에서 recipient_id = profileId 인 행을 조회하고,
 * 연결된 profit_reports 정보를 별도 쿼리로 join 한다.
 * (FK constraint 이름 의존 없이 수동 join)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  try {
    const profileId = req.nextUrl.searchParams.get('profileId')
    if (!profileId) return NextResponse.json({ error: 'profileId required' }, { status: 400 })

    // ── 인증: Authorization 헤더의 Bearer 토큰으로 유저 확인 ───────────────
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.replace('Bearer ', '').trim()
    if (!accessToken) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

    const { data: userData, error: authErr } = await admin.auth.getUser(accessToken)
    if (authErr || !userData.user) return NextResponse.json({ error: '인증 실패' }, { status: 401 })

    // 요청한 profileId가 본인 또는 본인이 소유한 프로필인지 확인
    const { data: profileCheck } = await admin
      .from('profiles')
      .select('id')
      .eq('id', profileId)
      .or(`id.eq.${userData.user.id},owner_id.eq.${userData.user.id}`)
      .single()
    if (!profileCheck) return NextResponse.json({ error: '접근 권한 없음' }, { status: 403 })

    // 1. 수당 분배 행 전체 조회 (페이지네이션 — 합계 정확성 위해 전부 로드)
    const allRows: { id: string; report_id: string; bonus_type: string; amount: number; rate: number; generation: number; created_at: string }[] = []
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin
        .from('payout_distributions')
        .select('id, report_id, bonus_type, amount, rate, generation, created_at')
        .eq('recipient_id', profileId)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1)
      if (error) throw error
      if (!data?.length) break
      allRows.push(...data)
      if (data.length < PAGE) break
    }

    // 2. 타입별 합계 (전체 기준)
    const totals = allRows.reduce((s, r) => {
      if (r.bonus_type === 'referral') s.referral += r.amount
      else if (r.bonus_type === 'rank') s.rank += r.amount
      else if (r.bonus_type === 'sponsor') s.sponsor += r.amount
      s.total += r.amount
      return s
    }, { referral: 0, rank: 0, sponsor: 0, total: 0 })

    // 2-B. 타입·세대(직급tier)·비율별 집계 — 내역을 하나로 합쳐 보여주기 위함
    const breakMap = new Map<string, { bonus_type: string; generation: number; rate: number; count: number; amount: number }>()
    for (const r of allRows) {
      const key = `${r.bonus_type}|${r.generation}|${r.rate}`
      const cur = breakMap.get(key) ?? { bonus_type: r.bonus_type, generation: r.generation, rate: r.rate, count: 0, amount: 0 }
      cur.count += 1
      cur.amount += r.amount
      breakMap.set(key, cur)
    }
    const typeOrder: Record<string, number> = { referral: 0, rank: 1, sponsor: 2 }
    const breakdown = [...breakMap.values()].sort((a, b) =>
      (typeOrder[a.bonus_type] - typeOrder[b.bonus_type]) || (a.generation - b.generation))

    if (!allRows.length) return NextResponse.json({ rows: [], totals, breakdown, rowCount: 0 })

    // 3. 표시는 최근 500건으로 제한
    const rows = allRows.slice(0, 500)

    // 4. 연결된 profit_reports 정보 수동 join
    const reportIds = [...new Set(rows.map(r => r.report_id))]
    const { data: reports } = await admin
      .from('profit_reports')
      .select('id, date_from, date_to, status')
      .in('id', reportIds)

    const reportMap = new Map<string, { date_from: string; date_to: string; status: string }>(
      (reports ?? []).map(r => [r.id, { date_from: r.date_from, date_to: r.date_to, status: r.status }])
    )

    const enriched = rows.map(row => ({
      ...row,
      profit_reports: reportMap.get(row.report_id) ?? null,
    }))

    return NextResponse.json({ rows: enriched, totals, breakdown, rowCount: allRows.length })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : (e as any)?.message ?? '조회 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
