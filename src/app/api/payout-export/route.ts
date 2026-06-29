/**
 * GET /api/payout-export?reportId=xxx
 *
 * 특정 profit_report의 수당 분배 결과를 CSV로 내보냄.
 * 관리자 전용 (service role).
 *
 * CSV 컬럼:
 *   node_id, name, rank, trc20_address, 추천수당, 직급수당, 후원수당, 합계
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function escapeCsv(v: string | number | null | undefined): string {
  if (v == null) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

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

    // 1. 분배 결과 조회
    const { data: rows, error } = await admin
      .from('payout_distributions')
      .select('recipient_id, bonus_type, amount')
      .eq('report_id', reportId)

    if (error) throw error

    // 2. 수령인 프로필 조회
    const recipientIds = [...new Set((rows ?? []).map(r => r.recipient_id))]
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, node_id, name, rank, owner_id, trc20_address')
      .in('id', recipientIds)

    // 2-B. TRC-20 주소는 계정(메인 프로필) 단위 — 각 노드의 소유 계정 주소를 조회
    //      account id = owner_id ?? id (owner_id 없으면 본인이 메인 계정)
    const accountIds = [...new Set((profiles ?? []).map(p => p.owner_id ?? p.id))]
    const { data: accounts } = await admin
      .from('profiles')
      .select('id, trc20_address')
      .in('id', accountIds)
    const accountAddrMap = new Map((accounts ?? []).map(a => [a.id, a.trc20_address]))

    const profileMap = new Map(
      (profiles ?? []).map(p => [p.id, { ...p, trc20_address: accountAddrMap.get(p.owner_id ?? p.id) ?? null }])
    )

    // 3. recipient 별 합산
    const summary = new Map<string, {
      referral: number; rank_bonus: number; sponsor: number
    }>()

    for (const row of (rows ?? [])) {
      const cur = summary.get(row.recipient_id) ?? { referral: 0, rank_bonus: 0, sponsor: 0 }
      if (row.bonus_type === 'referral') cur.referral    += row.amount
      if (row.bonus_type === 'rank')     cur.rank_bonus  += row.amount
      if (row.bonus_type === 'sponsor')  cur.sponsor     += row.amount
      summary.set(row.recipient_id, cur)
    }

    // 4. CSV 생성
    const BOM = '﻿'  // Excel UTF-8 BOM
    const header = ['Node ID', 'Name', 'Rank', 'TRC-20 Address', '추천수당', '직급수당', '후원수당', '합계'].join(',')
    const dataRows = [...summary.entries()]
      .map(([id, s]) => {
        const p = profileMap.get(id)
        const total = s.referral + s.rank_bonus + s.sponsor
        return [
          p?.node_id ?? id,
          p?.name ?? '',
          p?.rank ?? '',
          p?.trc20_address ?? '',
          s.referral.toFixed(2),
          s.rank_bonus.toFixed(2),
          s.sponsor.toFixed(2),
          total.toFixed(2),
        ].map(escapeCsv).join(',')
      })
      .sort()  // node_id 기준 정렬

    const csv = BOM + header + '\n' + dataRows.join('\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="payout_${reportId.slice(0, 8)}.csv"`,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : (e as any)?.message ?? '내보내기 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
