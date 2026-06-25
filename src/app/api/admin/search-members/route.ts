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

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  if (!token) return false
  const { data } = await admin.auth.getUser(token)
  return data.user?.user_metadata?.role === 'admin'
}

// PostgREST .or() 필터 인젝션 방지 — 구분자(.,():*\)·와일드카드 제거, 길이 제한
function sanitizeSearch(raw: string): string {
  return raw.replace(/[,.():*\\%_]/g, ' ').trim().slice(0, 50)
}

export async function GET(req: NextRequest) {
  try {
    if (!await verifyAdmin(req)) {
      return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
    }

    const rawQ = req.nextUrl.searchParams.get('q')
    const root = req.nextUrl.searchParams.get('root') === 'true'

    let query = admin
      .from('profiles')
      .select('id, node_id, name, rank, referrer_id')
      .limit(10)

    if (root) {
      // referrer_id IS NULL 인 루트 회원 (node_id 오름차순으로 결정적 선택)
      query = query.is('referrer_id', null).order('node_id', { ascending: true })
    } else if (rawQ) {
      const q = sanitizeSearch(rawQ)
      if (!q) return NextResponse.json({ members: [] })
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
