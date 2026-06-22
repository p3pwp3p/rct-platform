/**
 * GET /api/referral-tree?profileId=xxx&depth=4
 *
 * referrer_id 체인 기반 추천 트리 반환 (N-ary, 최대 4단계)
 * - 추천 수당: 1대 8%, 2대 4%, 3대 4%, 4대 4%
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export interface ReferralNode {
  id:             string
  node_id:        string
  name:           string
  rank:           string
  status:         string
  mt5_account_id: string | null
  created_at:     string
  depth:          number        // 1대=1, 2대=2, ...
  bonus_rate:     number        // 0.08, 0.04, 0.04, 0.04
  children:       ReferralNode[]
  total_count:    number        // 이 노드 포함 하위 전체 수 (재귀 합산)
}

const BONUS_RATES: Record<number, number> = {
  1: 0.08,
  2: 0.04,
  3: 0.04,
  4: 0.04,
}

export async function GET(req: NextRequest) {
  try {
    const profileId = req.nextUrl.searchParams.get('profileId')
    const maxDepth  = Math.min(parseInt(req.nextUrl.searchParams.get('depth') ?? '4'), 6)

    if (!profileId) return NextResponse.json({ error: 'profileId required' }, { status: 400 })

    // 전체 profiles 로드 (referrer_id 포함)
    const { data: profiles, error } = await admin
      .from('profiles')
      .select('id, node_id, name, rank, status, mt5_account_id, referrer_id, created_at')

    if (error) throw error

    type Row = { id: string; node_id: string; name: string; rank: string; status: string; mt5_account_id: string | null; referrer_id: string | null; created_at: string }
    const all = profiles as Row[]

    // referrer_id → children 맵
    const childrenMap = new Map<string, Row[]>()
    for (const p of all) {
      if (!p.referrer_id) continue
      const arr = childrenMap.get(p.referrer_id) ?? []
      arr.push(p)
      childrenMap.set(p.referrer_id, arr)
    }

    // 재귀 트리 빌드
    function buildTree(nodeId: string, depth: number): ReferralNode | null {
      const row = all.find(p => p.id === nodeId)
      if (!row) return null

      const children: ReferralNode[] = []
      if (depth < maxDepth) {
        const directRefs = childrenMap.get(nodeId) ?? []
        // 생성일 기준 정렬
        directRefs.sort((a, b) => a.created_at.localeCompare(b.created_at))
        for (const child of directRefs) {
          const childNode = buildTree(child.id, depth + 1)
          if (childNode) children.push(childNode)
        }
      }

      const total_count = 1 + children.reduce((s, c) => s + c.total_count, 0)

      return {
        id:             row.id,
        node_id:        row.node_id,
        name:           row.name,
        rank:           row.rank,
        status:         row.status,
        mt5_account_id: row.mt5_account_id,
        created_at:     row.created_at,
        depth,
        bonus_rate:     BONUS_RATES[depth] ?? 0,
        children,
        total_count,
      }
    }

    // depth=0 = 본인 (루트)
    const rootRow = all.find(p => p.id === profileId)
    if (!rootRow) return NextResponse.json({ error: '프로필을 찾을 수 없습니다' }, { status: 404 })

    const directRefs = childrenMap.get(profileId) ?? []
    directRefs.sort((a, b) => a.created_at.localeCompare(b.created_at))

    const children: ReferralNode[] = []
    for (const child of directRefs) {
      const node = buildTree(child.id, 1)
      if (node) children.push(node)
    }

    const root: ReferralNode = {
      id:             rootRow.id,
      node_id:        rootRow.node_id,
      name:           rootRow.name,
      rank:           rootRow.rank,
      status:         rootRow.status,
      mt5_account_id: rootRow.mt5_account_id,
      created_at:     rootRow.created_at,
      depth:          0,
      bonus_rate:     0,
      children,
      total_count:    1 + children.reduce((s, c) => s + c.total_count, 0),
    }

    // 레벨별 통계
    const levelStats: Record<number, { count: number; label: string; rate: number }> = {}
    function countLevels(node: ReferralNode) {
      if (node.depth > 0) {
        if (!levelStats[node.depth]) {
          levelStats[node.depth] = {
            count: 0,
            label: `${node.depth}대`,
            rate:  BONUS_RATES[node.depth] ?? 0,
          }
        }
        levelStats[node.depth].count++
      }
      for (const c of node.children) countLevels(c)
    }
    countLevels(root)

    return NextResponse.json({
      root,
      levelStats,
      totalReferrals: root.total_count - 1,  // 본인 제외
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : (e as any)?.message ?? '오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
