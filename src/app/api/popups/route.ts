/**
 * GET /api/popups
 *
 * 공개 라우트. 현재 노출 기간에 해당하는 활성 팝업만 반환.
 * (active = true AND start_at <= now AND (end_at IS NULL OR end_at >= now))
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET() {
  try {
    const nowIso = new Date().toISOString()
    const { data, error } = await admin
      .from('popups')
      .select('id, title, body, link_url, link_label')
      .eq('active', true)
      .lte('start_at', nowIso)
      .or(`end_at.is.null,end_at.gte.${nowIso}`)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ popups: data ?? [] })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '조회 오류'
    return NextResponse.json({ error: msg, popups: [] }, { status: 500 })
  }
}
