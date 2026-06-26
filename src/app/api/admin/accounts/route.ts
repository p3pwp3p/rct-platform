/**
 * GET /api/admin/accounts
 *
 * 계정(auth user) 기준으로 그룹핑된 회원 목록.
 * TRC-20은 auth 메타데이터 기준 (계정당 1개).
 * 각 계정 아래에 보유 노드 배열 포함.
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

    // 1. 전체 auth 유저
    const authUsers: {
      id: string; email?: string; created_at: string
      email_confirmed_at?: string | null
      user_metadata?: Record<string, unknown>
    }[] = []
    for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) throw error
      authUsers.push(...data.users)
      if (data.users.length < 1000) break
    }

    // 2. 전체 profiles
    const profiles: {
      id: string; node_id: string; name: string; rank: string; status: string
      sales: number; parent_id: string | null; leg_position: string | null
      mt5_account_id: string | null; trc20_address: string | null
      referral_code: string; owner_id: string | null; created_at: string
    }[] = []
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin
        .from('profiles')
        .select('id, node_id, name, rank, status, sales, parent_id, leg_position, mt5_account_id, trc20_address, referral_code, owner_id, created_at')
        .range(from, from + PAGE - 1)
      if (error) throw error
      if (!data?.length) break
      profiles.push(...data)
      if (data.length < PAGE) break
    }

    // 3. 노드를 owner_id(또는 id) 기준으로 그룹핑
    // owner_id가 null이고 id도 auth user가 아닌 경우(placeholder 노드)는
    // parent 체인을 따라 올라가 auth user를 찾는다
    const authUserIds = new Set(authUsers.map(u => u.id))
    const profileById = new Map(profiles.map(p => [p.id, p]))

    function resolveOwner(p: typeof profiles[0]): string {
      if (p.owner_id) return p.owner_id
      if (authUserIds.has(p.id)) return p.id
      // parent 체인 추적
      let cur = p
      for (let i = 0; i < 20; i++) {
        if (!cur.parent_id) break
        const parent = profileById.get(cur.parent_id)
        if (!parent) break
        if (parent.owner_id) return parent.owner_id
        if (authUserIds.has(parent.id)) return parent.id
        cur = parent
      }
      return p.id
    }

    const nodesByOwner = new Map<string, typeof profiles>()
    for (const p of profiles) {
      const key = resolveOwner(p)
      const arr = nodesByOwner.get(key) ?? []
      arr.push(p)
      nodesByOwner.set(key, arr)
    }

    // 4. 전체 하위 노드 수 계산 (재귀)
    const childrenOf = new Map<string, string[]>()
    for (const p of profiles) {
      if (p.parent_id) {
        const arr = childrenOf.get(p.parent_id) ?? []
        arr.push(p.id)
        childrenOf.set(p.parent_id, arr)
      }
    }
    function subtreeCount(id: string): number {
      const children = childrenOf.get(id) ?? []
      return children.reduce((s, c) => s + 1 + subtreeCount(c), 0)
    }

    // 5. 계정별 응답 구성 — 노드 보유 유저만
    const accounts = authUsers
      .filter(u => nodesByOwner.has(u.id))
      .map(u => {
        const nodes = (nodesByOwner.get(u.id) ?? []).sort((a, b) =>
          a.created_at.localeCompare(b.created_at)
        )
        // 전체 하위 = 각 보유 노드의 하위 합산 (중복 없도록 set 사용)
        const allDownlineIds = new Set<string>()
        function collectDown(id: string) {
          for (const cid of childrenOf.get(id) ?? []) {
            if (!allDownlineIds.has(cid)) { allDownlineIds.add(cid); collectDown(cid) }
          }
        }
        for (const n of nodes) collectDown(n.id)
        // 자기 소유 노드는 제외
        const ownIds = new Set(nodes.map(n => n.id))
        for (const id of ownIds) allDownlineIds.delete(id)

        return {
          id:         u.id,
          email:      u.email ?? '',
          name:       (u.user_metadata?.full_name as string) || nodes[0]?.name || '(이름없음)',
          phone:      (u.user_metadata?.phone as string) ?? null,
          trc20:      (u.user_metadata?.trc20_address as string) ?? null,
          is_admin:   u.user_metadata?.role === 'admin',
          confirmed:  !!u.email_confirmed_at,
          created_at: u.created_at,
          nodes,
          totalDownline: allDownlineIds.size,
        }
      })
      .sort((a, b) => {
        // RCT Platform 루트 맨 위, 나머지는 첫 노드의 node_id 순
        const aId = a.nodes[0]?.node_id ?? 'ZZZ'
        const bId = b.nodes[0]?.node_id ?? 'ZZZ'
        return aId.localeCompare(bId)
      })

    return NextResponse.json({ accounts })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '조회 오류', accounts: [] }, { status: 500 })
  }
}
