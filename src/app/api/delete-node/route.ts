/**
 * POST /api/delete-node
 *
 * 노드 삭제. body: { nodeId, accessToken }
 *  - 회원: 본인 노드 + 하위(후원·추천) 없을 때만 삭제 가능
 *  - 관리자: 하위가 있어도 collapse 삭제 (바이너리 자식 2개면 불가)
 *
 * 실제 재배치+삭제는 delete_node_cascade RPC 에서 단일 트랜잭션으로 처리.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  try {
    const { nodeId, accessToken } = await req.json()
    if (!nodeId || !accessToken) {
      return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
    }

    // 1. 인증
    const { data: userData, error: userErr } = await admin.auth.getUser(accessToken)
    if (userErr || !userData.user) {
      return NextResponse.json({ error: '인증 실패' }, { status: 401 })
    }
    const user = userData.user
    const isAdmin = user.app_metadata?.role === 'admin'

    // 2. 대상 노드 로드
    const { data: node, error: nodeErr } = await admin
      .from('profiles')
      .select('id, owner_id, parent_id, referrer_id')
      .eq('id', nodeId)
      .single()
    if (nodeErr || !node) {
      return NextResponse.json({ error: '노드를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 3. 하위 노드 조회
    const { data: binChildren } = await admin.from('profiles').select('id').eq('parent_id', nodeId)
    const { data: refChildren } = await admin.from('profiles').select('id').eq('referrer_id', nodeId)
    const binCount = binChildren?.length ?? 0
    const refCount = refChildren?.length ?? 0

    // 4. 권한 + 규칙
    if (!isAdmin) {
      const owns = node.owner_id === user.id || node.id === user.id
      if (!owns) {
        return NextResponse.json({ error: '본인 노드만 삭제할 수 있습니다.' }, { status: 403 })
      }
      if (binCount > 0 || refCount > 0) {
        return NextResponse.json({ error: '하위 노드가 있어 삭제할 수 없습니다. 관리자에게 문의하세요.' }, { status: 400 })
      }
    } else {
      if (binCount > 1) {
        return NextResponse.json({ error: '바이너리 하위 노드가 2개라 자동 삭제할 수 없습니다. 먼저 한쪽 서브트리를 이동해주세요.' }, { status: 400 })
      }
    }

    // 5. 원자적 삭제 (재배치 + 삭제)
    const { error: rpcErr } = await admin.rpc('delete_node_cascade', { target: nodeId })
    if (rpcErr) {
      const m = rpcErr.message || ''
      if (m.includes('BINARY_TWO_CHILDREN'))
        return NextResponse.json({ error: '바이너리 하위 노드가 2개라 자동 삭제할 수 없습니다. 먼저 한쪽 서브트리를 이동해주세요.' }, { status: 400 })
      if (m.includes('HAS_FINANCIAL_RECORDS'))
        return NextResponse.json({ error: '이 노드에 수당·정산 이력이 있어 삭제할 수 없습니다.' }, { status: 400 })
      if (m.includes('NODE_NOT_FOUND'))
        return NextResponse.json({ error: '노드를 찾을 수 없습니다.' }, { status: 404 })
      if (m.includes('foreign key') || m.includes('violates'))
        return NextResponse.json({ error: '연결된 데이터가 있어 삭제할 수 없습니다.' }, { status: 400 })
      throw new Error(m)
    }

    // 6. 영향받은 상위(부모·추천인) 직급 재검사 — 삭제로 하위 구성이 바뀜
    const rankCheckUrl = new URL('/api/rank-check', req.url).toString()
    const affected = [...new Set([node.parent_id, node.referrer_id].filter(Boolean))] as string[]
    await Promise.allSettled(
      affected.map(id =>
        fetch(rankCheckUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileId: id }) })
      )
    )

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '삭제 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
