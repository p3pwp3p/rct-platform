/**
 * POST /api/update-node
 *
 * 회원이 본인 노드(본인 행 또는 owner_id 소유 노드)의 제한된 필드를 수정.
 * RLS 는 owner 소유 노드의 직접 UPDATE 를 막으므로(rank/sales 보호),
 * 서버에서 소유권 검증 후 화이트리스트 컬럼만 service-role 로 갱신한다.
 *
 * body: { nodeId, name?, mt5AccountId? }  (Authorization: Bearer 필요)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, tooMany } from '@/lib/rate-limit'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const { nodeId, name, mt5AccountId } = await req.json()
    if (!nodeId) return NextResponse.json({ error: 'nodeId required' }, { status: 400 })

    // 1. 인증
    const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
    const { data: userData, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !userData.user) return NextResponse.json({ error: '인증 실패' }, { status: 401 })
    const uid = userData.user.id

    // 레이트리밋: 사용자당 분당 30회
    if (!await rateLimit(`update-node:${uid}`, 30, 60)) return NextResponse.json(tooMany, { status: 429 })

    // 2. 소유권 검증 (본인 행 또는 본인 소유 노드)
    const { data: node } = await admin
      .from('profiles')
      .select('id, owner_id')
      .eq('id', nodeId)
      .single()
    if (!node) return NextResponse.json({ error: '노드를 찾을 수 없습니다.' }, { status: 404 })
    if (node.id !== uid && node.owner_id !== uid) {
      return NextResponse.json({ error: '본인 노드만 수정할 수 있습니다.' }, { status: 403 })
    }

    // 3. 화이트리스트 컬럼만 구성 (rank/sales/parent 등은 절대 불가)
    const patch: Record<string, string | null> = {}
    if (name !== undefined) {
      const nm = String(name).trim()
      if (!nm) return NextResponse.json({ error: '이름을 입력해주세요.' }, { status: 400 })
      if (nm.length > 30) return NextResponse.json({ error: '이름이 너무 깁니다 (30자 이하)' }, { status: 400 })
      patch.name = nm
    }
    if (mt5AccountId !== undefined) {
      const v = String(mt5AccountId).trim()
      if (v && !/^\d{1,20}$/.test(v)) return NextResponse.json({ error: '계정 번호는 숫자만 입력해주세요.' }, { status: 400 })
      patch.mt5_account_id = v || null
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: '수정할 항목이 없습니다.' }, { status: 400 })
    }

    // 4. 갱신
    const { error: upErr } = await admin.from('profiles').update(patch).eq('id', nodeId)
    if (upErr) throw new Error(upErr.message)

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '수정 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
