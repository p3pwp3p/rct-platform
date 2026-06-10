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

const RANK_ORDER = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5']

// 다음 직급 승급 조건 (현재 rank → 다음 rank)
// legTotal : A/B 각 레그 총 하위 인원 수 (직급/상태 무관)
// legRank  : A/B 각 레그에서 요구되는 최소 직급 보유자
type RankReq = {
  direct:    number   // 직추천 활성 인원 수
  legTotal?: number   // A/B 각 레그 최소 총 인원
  legRank?:  string   // A/B 각 레그 필요 직급
  legCount?: number   // legRank 보유자 최소 수
}

const RANK_UP: Record<string, RankReq | null> = {
  // R0 → R1: 직추천 3명 + A/B 각 라인 총 10명 이상 (총 하위 20명)
  R0: { direct: 3, legTotal: 10 },
  // R1 → R2: 직추천 5명 + A/B 각 라인 R1 이상 2명
  R1: { direct: 5,  legRank: 'R1', legCount: 2 },
  // R2 → R3: 직추천 8명 + A/B 각 라인 R2 이상 2명
  R2: { direct: 8,  legRank: 'R2', legCount: 2 },
  // R3 → R4: 직추천 15명 + A/B 각 라인 R3 이상 2명
  R3: { direct: 15, legRank: 'R3', legCount: 2 },
  // R4 → R5: 직추천 20명 + A/B 각 라인 R4 이상 2명
  R4: { direct: 20, legRank: 'R4', legCount: 2 },
  R5: null,
}

type Profile = {
  id: string
  rank: string
  status: string
  parent_id: string | null
  referrer_id: string | null
  leg_position: 'LEFT' | 'RIGHT' | null
}

// 특정 노드 하위 전체 descendants
function getDescendants(rootId: string, all: Profile[]): Profile[] {
  const result: Profile[] = []
  const queue = [rootId]
  const seen  = new Set<string>()
  while (queue.length) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    const children = all.filter(p => p.parent_id === id)
    for (const c of children) { result.push(c); queue.push(c.id) }
  }
  return result
}

// 한 노드의 직급 조건 충족 여부 검사 → 충족 시 업그레이드 후 true 반환
async function tryUpgrade(profile: Profile, all: Profile[]): Promise<boolean> {
  const req = RANK_UP[profile.rank]
  if (!req) return false  // R5 최고 직급

  const nextRank = RANK_ORDER[RANK_ORDER.indexOf(profile.rank) + 1]

  // 직추천 = referrer_id가 이 노드인 활성 프로필 수 (추천 트리 1대)
  const directReferrals = all.filter(p => p.referrer_id === profile.id && p.status === 'active')
  if (directReferrals.length < req.direct) return false

  // ── A/B 각 레그 총 인원 수 체크 (R0→R1 조건: 각 라인 10명) ──────────
  if (req.legTotal && req.legTotal > 0) {
    const allChildren = all.filter(p => p.parent_id === profile.id)  // 상태 무관
    const leftDirect  = allChildren.find(c => c.leg_position === 'LEFT')
    const rightDirect = allChildren.find(c => c.leg_position === 'RIGHT')
    if (!leftDirect || !rightDirect) return false
    if (getDescendants(leftDirect.id,  all).length < req.legTotal) return false
    if (getDescendants(rightDirect.id, all).length < req.legTotal) return false
  }

  // ── 레그별 특정 직급 보유자 수 체크 ───────────────────────────────────
  if (req.legRank && (req.legCount ?? 0) > 0) {
    const allChildren = all.filter(p => p.parent_id === profile.id)
    const leftDirect  = allChildren.find(c => c.leg_position === 'LEFT')
    const rightDirect = allChildren.find(c => c.leg_position === 'RIGHT')
    if (!leftDirect || !rightDirect) return false

    // "R2 이상" = R2, R3, R4, R5 모두 포함 (누적 압축 방식)
    const countRankGte = (rootId: string, minRank: string) => {
      const minIdx = RANK_ORDER.indexOf(minRank)
      return getDescendants(rootId, all)
        .filter(p => RANK_ORDER.indexOf(p.rank) >= minIdx).length
    }

    if (countRankGte(leftDirect.id,  req.legRank) < (req.legCount ?? 0)) return false
    if (countRankGte(rightDirect.id, req.legRank) < (req.legCount ?? 0)) return false
  }

  // 승급 처리
  const { error: upErr } = await admin.from('profiles').update({ rank: nextRank }).eq('id', profile.id)
  if (upErr) throw upErr
  const { error: histErr } = await admin.from('rank_history').insert({
    profile_id:  profile.id,
    old_rank:    profile.rank,
    new_rank:    nextRank,
    changed_at:  new Date().toISOString(),
  })
  if (histErr) console.error('[rank_history insert]', histErr)  // 이력 실패해도 승급은 유지

  return true
}

/**
 * POST /api/rank-check
 * body: { profileId: string }   → 해당 노드 + 모든 상위 노드 승급 검사
 * body: { all: true }           → 전체 재계산 (관리자용)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // all: true 는 관리자만 사용 가능
    if (body.all && !await verifyAdmin(req)) {
      return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
    }

    // 전체 profiles 로드
    const { data: profiles, error } = await admin
      .from('profiles').select('id, rank, status, parent_id, referrer_id, leg_position')
    if (error) throw error
    const all = profiles as Profile[]

    const upgraded: string[] = []

    if (body.all) {
      // 전체 재계산: 아래 레벨부터 순서대로 (자식이 먼저 올라야 부모도 올라갈 수 있음)
      // BFS depth 역순으로 처리
      const depthMap = new Map<string, number>()
      const roots = all.filter(p => !p.parent_id)
      const queue: { id: string; depth: number }[] = roots.map(r => ({ id: r.id, depth: 0 }))
      while (queue.length) {
        const { id, depth } = queue.shift()!
        depthMap.set(id, depth)
        all.filter(p => p.parent_id === id).forEach(c => queue.push({ id: c.id, depth: depth + 1 }))
      }
      const sorted = [...all].sort((a, b) => (depthMap.get(b.id) ?? 0) - (depthMap.get(a.id) ?? 0))
      for (const p of sorted) {
        // 최신 rank 반영 (이전 루프에서 업그레이드됐을 수 있음)
        const fresh = all.find(x => x.id === p.id)!
        const ok = await tryUpgrade(fresh, all)
        if (ok) {
          fresh.rank = RANK_ORDER[RANK_ORDER.indexOf(fresh.rank) + 1]
          upgraded.push(fresh.id)
        }
      }
    } else {
      // 특정 노드 + 조상들만 검사
      const { profileId } = body
      if (!profileId) return NextResponse.json({ error: 'profileId required' }, { status: 400 })

      let currentId: string | null = profileId
      const visited = new Set<string>()
      while (currentId && !visited.has(currentId)) {
        visited.add(currentId)
        const p = all.find(x => x.id === currentId)
        if (!p) break
        const ok = await tryUpgrade(p, all)
        if (ok) { p.rank = RANK_ORDER[RANK_ORDER.indexOf(p.rank) + 1]; upgraded.push(p.id) }
        currentId = p.parent_id
      }
    }

    return NextResponse.json({ upgraded })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : (e as any)?.message ?? '오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
