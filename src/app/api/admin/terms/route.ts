/**
 * 관리자 약관 CRUD
 *
 *  GET    /api/admin/terms        — 전체 약관 목록 (미게시 포함)
 *  POST   /api/admin/terms        — 신규  { title, body?, sort_order?, published? }
 *  PATCH  /api/admin/terms        — 수정  { id, ...fields }
 *  DELETE /api/admin/terms?id=xxx — 삭제
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
  return data.user?.app_metadata?.role === 'admin'
}

export async function GET(req: NextRequest) {
  try {
    if (!await verifyAdmin(req)) return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
    const { data, error } = await admin
      .from('terms')
      .select('id, title, body, sort_order, published, updated_at, created_at')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) throw error
    return NextResponse.json({ terms: data ?? [] })
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
      .from('terms')
      .insert({
        title:      b.title.trim(),
        body:       b.body?.trim() ?? '',
        sort_order: Number.isFinite(b.sort_order) ? b.sort_order : 0,
        published:  b.published ?? true,
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
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (b.title      !== undefined) patch.title      = b.title.trim()
    if (b.body       !== undefined) patch.body       = b.body?.trim() ?? ''
    if (b.sort_order !== undefined) patch.sort_order = Number.isFinite(b.sort_order) ? b.sort_order : 0
    if (b.published  !== undefined) patch.published  = b.published
    const { error } = await admin.from('terms').update(patch).eq('id', b.id)
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
    const { error } = await admin.from('terms').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '삭제 오류' }, { status: 500 })
  }
}
