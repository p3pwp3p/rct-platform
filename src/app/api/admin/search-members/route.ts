/**
 * GET /api/admin/search-members?q=검색어
 * GET /api/admin/search-members?root=true  → referrer_id가 NULL인 루트 회원
 *
 * 어드민 추천 트리 검색용
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  try {
    const q    = req.nextUrl.searchParams.get('q')
    const root = req.nextUrl.searchParams.get('root') === 'true'

    let query = admin
      .from('profiles')
      .select('id, node_id, name, rank, referrer_id')
      .limit(10)

    if (root) {
      // referrer_id IS NULL 인 루트 회원 (node_id 오름차순으로 결정적 선택)
      query = query.is('referrer_id', null).order('node_id', { ascending: true })
    } else if (q) {
      query = query.or(`node_id.ilike.%${q}%,name.ilike.%${q}%`)
    } else {
      return NextResponse.json({ members: [] })
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({
      members: (data ?? []).map(r => ({
        id:      r.id,
        node_id: r.node_id,
        name:    r.name,
        rank:    r.rank,
      })),
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : (e as any)?.message ?? '오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
