/**
 * GET /api/admin/forfeited?reportId=xxx
 *
 * 특정 profit_report 에서 낙전 처리된 수당 내역을 반환.
 * 관리자 전용.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  if (!token) return false
  const { data } = await admin.auth.getUser(token)
  return data.user?.app_metadata?.role === 'admin'
}

export async function GET(req: NextRequest) {
  try {
    if (!await verifyAdmin(req)) {
      return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
    }

    const reportId = req.nextUrl.searchParams.get('reportId')
    if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 })

    // 1. forfeited_bonuses 조회
    const { data: rows, error } = await admin
      .from('forfeited_bonuses')
      .select('id, profile_id, amount, reason, created_at')
      .eq('report_id', reportId)
      .order('amount', { ascending: false })

    if (error) throw error
    if (!rows?.length) return NextResponse.json({ rows: [] })

    // 2. 프로필 정보 수동 join
    const profileIds = [...new Set(rows.map(r => r.profile_id))]
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, node_id, name, rank, status')
      .in('id', profileIds)

    const profileMap = new Map(
      (profiles ?? []).map(p => [p.id, p])
    )

    const enriched = rows.map(r => {
      const p = profileMap.get(r.profile_id)
      return {
        id:         r.id,
        profile_id: r.profile_id,
        node_id:    p?.node_id ?? '?',
        name:       p?.name    ?? '?',
        rank:       p?.rank    ?? '?',
        status:     p?.status  ?? '?',
        amount:     r.amount,
        reason:     r.reason,
        created_at: r.created_at,
      }
    })

    const total = enriched.reduce((s, r) => s + r.amount, 0)

    return NextResponse.json({ rows: enriched, total })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : (e as any)?.message ?? '조회 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
