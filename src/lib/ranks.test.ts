import { describe, it, expect } from 'vitest'
import {
  RANK_ORDER,
  RANK_REQUIREMENTS,
  nextRank,
  rankGte,
  sumRankGte,
  reqSummary,
} from './ranks'
import type { RankCounts } from './types'

describe('nextRank', () => {
  it('한 단계 위 직급을 반환', () => {
    expect(nextRank('R0')).toBe('R1')
    expect(nextRank('R4')).toBe('R5')
  })
  it('최고 직급(R5)은 null', () => {
    expect(nextRank('R5')).toBeNull()
  })
})

describe('rankGte', () => {
  it('이상(≥) 비교', () => {
    expect(rankGte('R3', 'R1')).toBe(true)
    expect(rankGte('R1', 'R1')).toBe(true)
    expect(rankGte('R1', 'R3')).toBe(false)
  })
})

describe('sumRankGte', () => {
  const counts: RankCounts = { R0: 5, R1: 2, R2: 0, R3: 1, R4: 0, R5: 1 }
  it('minRank 이상 카운트를 합산', () => {
    expect(sumRankGte(counts, 'R2')).toBe(2)   // R3(1) + R5(1)
    expect(sumRankGte(counts, 'R1')).toBe(4)   // 2+0+1+0+1
    expect(sumRankGte(counts, 'R5')).toBe(1)   // R5만
  })
  it('counts 가 없으면 0', () => {
    expect(sumRankGte(undefined, 'R1')).toBe(0)
  })
})

describe('reqSummary', () => {
  it('R0: legTotal 형식', () => {
    expect(reqSummary('R0')).toBe('직추천 3 · L/R 각 10명')
  })
  it('R1: legRank 형식', () => {
    expect(reqSummary('R1')).toBe('직추천 5 · L/R 각 R1 이상 2명')
  })
  it('R5: 최고 직급', () => {
    expect(reqSummary('R5')).toBe('최고 직급')
  })
})

describe('RANK_REQUIREMENTS 무결성', () => {
  it('R5를 제외한 모든 직급에 승급 조건이 정의됨', () => {
    for (const r of RANK_ORDER) {
      if (r === 'R5') expect(RANK_REQUIREMENTS[r]).toBeNull()
      else expect(RANK_REQUIREMENTS[r]).not.toBeNull()
    }
  })
})
