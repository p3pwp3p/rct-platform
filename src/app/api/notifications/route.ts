/**
 * GET   /api/notifications        → 본인 알림 목록(최근 30) + 미읽음 수
 * PATCH /api/notifications        → 읽음처리  body: { ids?: string[], all?: boolean }
 *
 * 인증: Authorization Bearer 토큰. service-role 로 조회하되 user_id 로 본인만 필터.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function getUserId(req: NextRequest): Promise<string | null> {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  if (!token) return null
  const { data } = await admin.auth.getUser(token)
  return data.user?.id ?? null
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

    const { data, error } = await admin
      .from('notifications')
      .select('id, type, title, body, metadata, read_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)
    if (error) throw error

    const unread = (data ?? []).filter(n => !n.read_at).length
    return NextResponse.json({ notifications: data ?? [], unread })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '조회 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

    const { ids, all } = await req.json().catch(() => ({}))
    const now = new Date().toISOString()

    let q = admin.from('notifications').update({ read_at: now }).eq('user_id', userId).is('read_at', null)
    if (!all) {
      if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: 'ids 또는 all 필요' }, { status: 400 })
      }
      q = q.in('id', ids)
    }
    const { error } = await q
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '처리 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
