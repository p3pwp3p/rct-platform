// ───────────────────────────────────────────────────────────────────────────
// 직급(Rank) 단일 소스
//
// 승급 조건·색상·순서를 한 곳에서 정의한다. 서버 판정(api/rank-check)과
// 화면 표시(dashboard, analytics)가 모두 이 모듈을 import 하므로, 조건을
// 바꾸려면 여기만 수정하면 된다. (과거에는 3곳에 중복 정의돼 드리프트로
// 인한 표시 오류가 발생했다.)
// ───────────────────────────────────────────────────────────────────────────
import type { Rank, RankCounts } from './types'

export const RANK_ORDER: readonly Rank[] = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5']

export const RANK_COLOR: Record<Rank, string> = {
  R0: '#64748b', R1: '#34d399', R2: '#60a5fa',
  R3: '#fbbf24', R4: '#f97316', R5: '#a78bfa',
}

/**
 * 다음 직급 승급 조건. 키 = "현재" 직급, 값 = 다음 직급에 도달하기 위한 조건.
 *   legTotal : A/B 각 레그 총 하위 인원 수 (직급/상태 무관)        — R0→R1
 *   legRank  : A/B 각 레그에서 요구되는 최소 직급                  — R1→R5
 *   legCount : legRank 이상(≥) 보유자 최소 수 (각 레그)
 */
export type RankRequirement = {
  direct:    number
  legTotal?: number
  legRank?:  Rank
  legCount?: number
}

export const RANK_REQUIREMENTS: Record<Rank, RankRequirement | null> = {
  R0: { direct: 3,  legTotal: 10 },
  R1: { direct: 5,  legRank: 'R1', legCount: 2 },
  R2: { direct: 8,  legRank: 'R2', legCount: 2 },
  R3: { direct: 15, legRank: 'R3', legCount: 2 },
  R4: { direct: 20, legRank: 'R4', legCount: 2 },
  R5: null,
}

/** 한 단계 위 직급. 최고 직급(R5)이면 null. */
export function nextRank(rank: Rank): Rank | null {
  const idx = RANK_ORDER.indexOf(rank)
  return idx >= 0 && idx < RANK_ORDER.length - 1 ? RANK_ORDER[idx + 1] : null
}

/** rank 이 minRank 이상(≥)인지 */
export function rankGte(rank: Rank, minRank: Rank): boolean {
  return RANK_ORDER.indexOf(rank) >= RANK_ORDER.indexOf(minRank)
}

/** rankCounts(각 직급 정확 카운트)에서 minRank 이상(≥)을 합산 */
export function sumRankGte(counts: RankCounts | undefined, minRank: Rank): number {
  const minIdx = RANK_ORDER.indexOf(minRank)
  if (minIdx < 0 || !counts) return 0
  return RANK_ORDER.slice(minIdx).reduce((s, r) => s + (counts[r] ?? 0), 0)
}

/** 현재 직급 기준 "다음 직급 달성 조건" 한 줄 요약 */
export function reqSummary(rank: Rank): string {
  const req = RANK_REQUIREMENTS[rank]
  if (!req) return '최고 직급'
  if (req.legTotal) return `직추천 ${req.direct} · L/R 각 ${req.legTotal}명`
  if (req.legRank)  return `직추천 ${req.direct} · L/R 각 ${req.legRank} 이상 ${req.legCount}명`
  return `직추천 ${req.direct}`
}
