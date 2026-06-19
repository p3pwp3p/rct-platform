/**
 * 관리자 팝업 CRUD
 *
 *  GET    /api/admin/popups        — 전체 팝업 목록 (기간 무관)
 *  POST   /api/admin/popups        — 신규 생성  { title, body?, link_url?, link_label?, start_at?, end_at?, active? }
 *  PATCH  /api/admin/popups        — 수정       { id, ...fields }
 *  DELETE /api/admin/popups?id=xxx — 삭제
 *
 * 모든 메서드 관리자 전용.
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
    if (!await verifyAdmin(req)) return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
    const { data, error } = await admin
      .from('popups')
      .select('id, title, body, link_url, link_label, start_at, end_at, active, created_at')
      .order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ popups: data ?? [] })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '조회 오류' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!await verifyAdmin(req)) return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
    const b = await req.json()
    if (!b.title?.trim()) return NextResponse.json({ error: '제목은 필수입니다.' }, { status: 400 })
    const { data, error } = await admin
      .from('popups')
      .insert({
        title:      b.title.trim(),
        body:       b.body?.trim() ?? '',
        link_url:   b.link_url?.trim() || null,
        link_label: b.link_label?.trim() || null,
        start_at:   b.start_at || new Date().toISOString(),
        end_at:     b.end_at || null,
        active:     b.active ?? true,
      })
      .select('id')
      .single()
    if (error) throw error
    return NextResponse.json({ success: true, id: data.id })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '생성 오류' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!await verifyAdmin(req)) return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
    const b = await req.json()
    if (!b.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const patch: Record<string, unknown> = {}
    if (b.title      !== undefined) patch.title      = b.title.trim()
    if (b.body       !== undefined) patch.body       = b.body?.trim() ?? ''
    if (b.link_url   !== undefined) patch.link_url   = b.link_url?.trim() || null
    if (b.link_label !== undefined) patch.link_label = b.link_label?.trim() || null
    if (b.start_at   !== undefined) patch.start_at   = b.start_at || new Date().toISOString()
    if (b.end_at     !== undefined) patch.end_at     = b.end_at || null
    if (b.active     !== undefined) patch.active     = b.active
    const { error } = await admin.from('popups').update(patch).eq('id', b.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '수정 오류' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!await verifyAdmin(req)) return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { error } = await admin.from('popups').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '삭제 오류' }, { status: 500 })
  }
}
