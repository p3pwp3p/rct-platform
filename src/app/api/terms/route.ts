/**
 * GET /api/terms
 *
 * 공개 라우트. 게시(published)된 약관 문서를 노출 순서대로 반환.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET() {
  try {
    const { data, error } = await admin
      .from('terms')
      .select('id, title, body, updated_at')
      .eq('published', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) throw error
    return NextResponse.json({ terms: data ?? [] })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '조회 오류'
    return NextResponse.json({ error: msg, terms: [] }, { status: 500 })
  }
}
