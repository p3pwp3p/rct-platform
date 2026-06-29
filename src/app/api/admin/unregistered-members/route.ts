/**
 * GET /api/admin/unregistered-members
 *
 * 가입(auth)은 했지만 노드(profiles)를 하나도 보유하지 않은 회원 목록.
 * 노드 보유 판정: profiles 중 id = uid 또는 owner_id = uid 가 하나라도 있으면 보유.
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
    if (!await verifyAdmin(req)) return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })

    // 1. 노드를 보유한 auth uid 집합 (id + owner_id)
    const ownerSet = new Set<string>()
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin
        .from('profiles')
        .select('id, owner_id')
        .range(from, from + PAGE - 1)
      if (error) throw error
      if (!data?.length) break
      for (const p of data) {
        ownerSet.add(p.id)
        if (p.owner_id) ownerSet.add(p.owner_id)
      }
      if (data.length < PAGE) break
    }

    // 2. 전체 auth 유저
    const users: { id: string; email?: string; created_at: string; email_confirmed_at?: string | null; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> }[] = []
    for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) throw error
      users.push(...data.users)
      if (data.users.length < 1000) break
    }

    // 3. 노드 미보유 유저만
    const unregistered = users
      .filter(u => !ownerSet.has(u.id))
      .map(u => ({
        id:         u.id,
        email:      u.email ?? '',
        name:       (u.user_metadata?.full_name as string) ?? '(이름없음)',
        phone:      (u.user_metadata?.phone as string) ?? null,
        trc20:      (u.user_metadata?.trc20_address as string) ?? null,
        is_admin:   u.app_metadata?.role === 'admin',
        confirmed:  !!u.email_confirmed_at,
        created_at: u.created_at,
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json({ members: unregistered })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '조회 오류', members: [] }, { status: 500 })
  }
}
