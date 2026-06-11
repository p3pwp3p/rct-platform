/**
 * POST /api/payout-calc
 *
 * 특정 profit_report에 대한 수당 계산 실행.
 * 결과를 payout_distributions 테이블에 저장.
 *
 * body: { reportId: string, preview?: boolean }
 *   preview=true → DB 저장 없이 계산 결과만 반환
 *   preview=false (기본) → payout_distributions에 upsert
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  calcAllBonuses,
  summarizeByRecipient,
  type PayoutNode,
  type EarnerItem,
} from '@/lib/payout-engine'

// payout-engine의 calcReferralBonus / calcRankBonus 반환 타입 변경에 맞춰
// calcAllBonuses 가 { distributions, forfeited } 를 반환함

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  if (!token) return false
  const { data } = await admin.auth.getUser(token)
  return data.user?.user_metadata?.role === 'admin'
}

export async function POST(req: NextRequest) {
  try {
    if (!await verifyAdmin(req)) {
      return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
    }

    const { reportId, preview = false } = await req.json()
    if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 })

    // ── 0. 보고서 상태 확인 — 이미 지급완료된 보고서는 재계산 차단 ────────────
    const { data: reportMeta, error: reportMetaErr } = await admin
      .from('profit_reports')
      .select('id, status, date_from, date_to')
      .eq('id', reportId)
      .single()
    if (reportMetaErr) throw reportMetaErr
    if (reportMeta.status === 'paid') {
      return NextResponse.json({ error: '이미 지급완료된 보고서는 재계산할 수 없습니다.' }, { status: 409 })
    }

    // ── 1. Report items 로드 ────────────────────────────────────────────────
    const { data: items, error: itemErr } = await admin
      .from('profit_report_items')
      .select('matched_profile_id, unpaid_profit')
      .eq('report_id', reportId)
      .not('matched_profile_id', 'is', null)

    if (itemErr) throw itemErr
    if (!items?.length) {
      return NextResponse.json({ error: '보고서에 매칭된 프로필 없음' }, { status: 400 })
    }

    const earners: EarnerItem[] = items.map(i => ({
      profile_id:    i.matched_profile_id as string,
      unpaid_profit: i.unpaid_profit as number,
    }))

    // ── 2. 전체 profiles 로드 ────────────────────────────────────────────────
    const { data: profiles, error: profErr } = await admin
      .from('profiles')
      .select('id, rank, status, parent_id, referrer_id, leg_position')

    if (profErr) throw profErr

    const nodeMap = new Map<string, PayoutNode>()
    for (const p of (profiles ?? [])) {
      nodeMap.set(p.id, p as PayoutNode)
    }

    // ── 2-B. 같은 달 기존 후원수당 누계 조회 (월 $20,000 한도 공유) ────────────
    const reportMonth = reportMeta.date_from.slice(0, 7)  // "YYYY-MM"

    // 같은 달에 속하는 다른 보고서 ID 목록 먼저 조회
    const monthStart = reportMonth + '-01'
    // 다음 달 1일을 상한으로 사용 (date 타입에 '-31' 붙이면 2월 등에서 invalid date 에러)
    const nextMonthDate = new Date(monthStart)
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1)
    const nextMonthStart = nextMonthDate.toISOString().slice(0, 10)
    const { data: sameMonthReports } = await admin
      .from('profit_reports')
      .select('id')
      .gte('date_from', monthStart)
      .lt('date_from', nextMonthStart)
      .neq('id', reportId)

    const alreadyPaidMap = new Map<string, number>()
    if (sameMonthReports?.length) {
      const sameMonthIds = sameMonthReports.map(r => r.id)
      const { data: prevSponsor } = await admin
        .from('payout_distributions')
        .select('recipient_id, amount')
        .eq('bonus_type', 'sponsor')
        .in('report_id', sameMonthIds)

      for (const row of (prevSponsor ?? [])) {
        const cur = alreadyPaidMap.get(row.recipient_id) ?? 0
        alreadyPaidMap.set(row.recipient_id, cur + row.amount)
      }
    }

    // ── 3. 수당 계산 ─────────────────────────────────────────────────────────
    const { distributions, forfeited, companyForfeited } = calcAllBonuses(earners, nodeMap, alreadyPaidMap)
    const summary = summarizeByRecipient(distributions)

    // ── 4. 결과 정리 ─────────────────────────────────────────────────────────
    const totalReferral = distributions.filter(r => r.bonus_type === 'referral').reduce((s, r) => s + r.amount, 0)
    const totalRank     = distributions.filter(r => r.bonus_type === 'rank').reduce((s, r) => s + r.amount, 0)
    const totalSponsor  = distributions.filter(r => r.bonus_type === 'sponsor').reduce((s, r) => s + r.amount, 0)
    const totalForfeited = forfeited.reduce((s, f) => s + f.amount, 0)

    const totalBase = earners.reduce((s, e) => s + e.unpaid_profit, 0)

    const result = {
      reportId,
      earnerCount:      earners.length,
      totalBase,
      totalReferral,
      totalRank,
      totalSponsor,
      totalForfeited,
      companyForfeited,   // 적격 직급자 없는 tier 풀 → 회사 귀속
      totalDistributed: totalReferral + totalRank + totalSponsor,
      rowCount:         distributions.length,
      recipientCount:   summary.size,
      forfeitedCount:   forfeited.length,
    }

    if (preview) {
      // 수령인 프로필 이름/nodeId 조회 (미리보기 테이블 표시용)
      const recipientIds = [...summary.keys()]
      const { data: recipProfiles } = await admin
        .from('profiles')
        .select('id, node_id, name, rank')
        .in('id', recipientIds)
      const recipProfileMap = new Map((recipProfiles ?? []).map((p: { id: string; node_id: string; name: string; rank: string }) => [p.id, p]))

      const recipientSummary = [...summary.entries()].map(([id, s]) => {
        const p = recipProfileMap.get(id)
        return {
          profileId:  id,
          nodeId:     p?.node_id ?? '?',
          name:       p?.name    ?? '—',
          nodeRank:   p?.rank    ?? '?',
          referral:   s.referral,
          rank_bonus: s.rank,   // summarizeByRecipient uses 'rank' key; UI expects 'rank_bonus'
          sponsor:    s.sponsor,
          total:      s.total,
        }
      })
      return NextResponse.json({ ...result, recipientSummary })
    }

    // ── 5. DB 저장 ───────────────────────────────────────────────────────────
    // 기존 이 보고서의 분배/낙전 결과 삭제 후 재삽입
    await admin.from('payout_distributions').delete().eq('report_id', reportId)
    await admin.from('forfeited_bonuses').delete().eq('report_id', reportId)

    const insertRows = distributions.map(d => ({
      report_id:    reportId,
      source_id:    d.source_id,
      recipient_id: d.recipient_id,
      bonus_type:   d.bonus_type,
      amount:       d.amount,
      rate:         d.rate,
      generation:   d.generation,
    }))

    const BATCH = 500
    for (let i = 0; i < insertRows.length; i += BATCH) {
      const { error: insErr } = await admin
        .from('payout_distributions')
        .insert(insertRows.slice(i, i + BATCH))
      if (insErr) throw insErr
    }

    // 낙전 저장
    if (forfeited.length > 0) {
      const forfeitedRows = forfeited.map(f => ({
        report_id:  reportId,
        profile_id: f.profile_id,
        amount:     f.amount,
        reason:     f.reason,
      }))
      for (let i = 0; i < forfeitedRows.length; i += BATCH) {
        const { error: fErr } = await admin
          .from('forfeited_bonuses')
          .insert(forfeitedRows.slice(i, i + BATCH))
        if (fErr) console.error('[forfeited insert]', fErr)  // 실패해도 진행
      }
    }

    return NextResponse.json({ ...result, saved: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : (e as any)?.message ?? '계산 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * GET /api/payout-calc?reportId=xxx
 * 이미 계산된 결과 조회
 */
export async function GET(req: NextRequest) {
  try {
    if (!await verifyAdmin(req)) {
      return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
    }
    const reportId = req.nextUrl.searchParams.get('reportId')
    if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 })

    // 1. 분배 결과 조회 (profiles join 없이)
    const { data, error } = await admin
      .from('payout_distributions')
      .select('bonus_type, amount, rate, generation, recipient_id, source_id')
      .eq('report_id', reportId)
      .order('bonus_type')
      .order('amount', { ascending: false })

    if (error) throw error

    // 2. recipient별 합산
    const byRecipient = new Map<string, {
      nodeId: string; name: string; rank: string
      referral: number; rank_bonus: number; sponsor: number; total: number
    }>()

    for (const row of (data ?? [])) {
      const key = row.recipient_id
      const cur = byRecipient.get(key) ?? {
        nodeId: '?', name: '?', rank: '?',
        referral: 0, rank_bonus: 0, sponsor: 0, total: 0,
      }
      if (row.bonus_type === 'referral') cur.referral += row.amount
      else if (row.bonus_type === 'rank') cur.rank_bonus += row.amount
      else if (row.bonus_type === 'sponsor') cur.sponsor += row.amount
      cur.total += row.amount
      byRecipient.set(key, cur)
    }

    // 3. 프로필 수동 join
    const recipientIds = [...byRecipient.keys()]
    if (recipientIds.length > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, node_id, name, rank')
        .in('id', recipientIds)
      for (const p of (profiles ?? [])) {
        const cur = byRecipient.get(p.id)
        if (cur) { cur.nodeId = p.node_id; cur.name = p.name; cur.rank = p.rank }
      }
    }

    return NextResponse.json({
      reportId,
      rowCount:   data?.length ?? 0,
      recipients: [...byRecipient.values()].sort((a, b) => b.total - a.total),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : (e as any)?.message ?? '조회 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
