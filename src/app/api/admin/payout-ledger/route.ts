/**
 * GET /api/admin/payout-ledger
 *
 * 전체 payout_distributions를 수령 노드(recipient)별로 집계.
 * 각 노드가 추천·직급·후원 수당으로 얼마를 받았는지 누적 합산해 반환.
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
  return data.user?.user_metadata?.role === 'admin'
}

export async function GET(req: NextRequest) {
  try {
    if (!await verifyAdmin(req)) {
      return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
    }

    // 1. 분배 행 전체 로드 (페이지네이션 없이 — 데모 규모)
    const all: { recipient_id: string; bonus_type: string; amount: number }[] = []
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin
        .from('payout_distributions')
        .select('recipient_id, bonus_type, amount')
        .range(from, from + PAGE - 1)
      if (error) throw error
      if (!data?.length) break
      all.push(...data)
      if (data.length < PAGE) break
    }

    // 2. recipient별 집계
    type Agg = { referral: number; rank: number; sponsor: number; total: number; count: number }
    const byRecipient = new Map<string, Agg>()
    for (const row of all) {
      const cur = byRecipient.get(row.recipient_id) ?? { referral: 0, rank: 0, sponsor: 0, total: 0, count: 0 }
      if (row.bonus_type === 'referral')      cur.referral += row.amount
      else if (row.bonus_type === 'rank')     cur.rank     += row.amount
      else if (row.bonus_type === 'sponsor')  cur.sponsor  += row.amount
      cur.total += row.amount
      cur.count += 1
      byRecipient.set(row.recipient_id, cur)
    }

    // 3. 프로필 정보 join
    const ids = [...byRecipient.keys()]
    const profMap = new Map<string, { node_id: string; name: string; rank: string; status: string; trc20_address: string | null }>()
    for (let i = 0; i < ids.length; i += 200) {
      const { data: profs } = await admin
        .from('profiles')
        .select('id, node_id, name, rank, status, trc20_address')
        .in('id', ids.slice(i, i + 200))
      for (const p of (profs ?? [])) profMap.set(p.id, p)
    }

    const rows = [...byRecipient.entries()].map(([id, a]) => {
      const p = profMap.get(id)
      return {
        profile_id:    id,
        node_id:       p?.node_id ?? '?',
        name:          p?.name ?? '—',
        rank:          p?.rank ?? 'R0',
        status:        p?.status ?? 'active',
        trc20_address: p?.trc20_address ?? null,
        referral:      a.referral,
        rank_bonus:    a.rank,
        sponsor:       a.sponsor,
        total:         a.total,
        count:         a.count,
      }
    }).sort((x, y) => y.total - x.total)

    const totals = rows.reduce((s, r) => ({
      referral: s.referral + r.referral,
      rank:     s.rank + r.rank_bonus,
      sponsor:  s.sponsor + r.sponsor,
      total:    s.total + r.total,
    }), { referral: 0, rank: 0, sponsor: 0, total: 0 })

    return NextResponse.json({ rows, recipientCount: rows.length, totals })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : (e as any)?.message ?? '조회 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
