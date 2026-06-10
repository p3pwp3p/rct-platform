/**
 * RCT Platform — 수당 계산 엔진
 *
 * 분윤 구조 (PDF 기준):
 *   MT5 수익 × 50% = 분윤 (이미 PDF에서 계산된 unpaid_profit 값)
 *   분윤 100% 중:
 *     - 20% 회사 운영비
 *     - 80% 레퍼럴 수당:
 *         ① 추천 수당 20%: 직접 추천인 체인 (1대 8%, 2대 4%, 3대 4%, 4대 4%)
 *         ② 직급 수당 20%: 상위 직급 노드에 지급 (R1 8%, R2 4%, R3 2%, R4 1%, R5 0.5%) — 직급 누적 압축
 *         ③ 후원 수당 40%: 바이너리 소실적 기준 8%, 월 MAX $20,000
 */

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export type BonusType = 'referral' | 'rank' | 'sponsor'

export interface ForfeitedItem {
  profile_id: string                        // 수령 불가 노드
  amount:     number
  reason:     'suspended' | 'expelled'
}

export interface PayoutNode {
  id:           string
  rank:         string   // R0-R5
  status:       string   // active | suspended | expelled
  parent_id:    string | null
  referrer_id:  string | null
  leg_position: 'LEFT' | 'RIGHT' | null
}

export interface EarnerItem {
  profile_id:    string   // 수익 발생 노드 ID
  unpaid_profit: number   // 이 노드의 분윤 금액
}

export interface DistributionRow {
  source_id:    string      // 수익 발생 원천 노드
  recipient_id: string      // 수당 수령인
  bonus_type:   BonusType
  amount:       number
  rate:         number      // 적용 비율 (0.08 = 8%)
  generation:   number      // 추천: 몇 대, 직급: 몇 번째 레이어
}

// ─── 상수 ────────────────────────────────────────────────────────────────────

/** 추천 수당 레이어별 비율 (1대~4대) */
const REFERRAL_RATES = [0.08, 0.04, 0.04, 0.04]  // 합 = 0.20 (20%)

/** 직급 수당: 직급별 추가 비율 (누적 압축 방식) */
const RANK_RATES: Record<string, number> = {
  R1: 0.08,
  R2: 0.04,
  R3: 0.02,
  R4: 0.01,
  R5: 0.005,
}
const RANK_ORDER = ['R1', 'R2', 'R3', 'R4', 'R5']

/** 후원 수당 비율 및 월 상한 */
const SPONSOR_RATE      = 0.08      // 소실적 기준 8%
const SPONSOR_MAX_MONTH = 20_000    // 월 $20,000

// ─── 내부 유틸 ────────────────────────────────────────────────────────────────

/** referrer_id 체인을 따라 최대 maxGen단계 올라가며 ID 목록 반환 */
function getReferrerChain(
  startId: string,
  nodeMap: Map<string, PayoutNode>,
  maxGen = 4,
): string[] {
  const chain: string[] = []
  let current = nodeMap.get(startId)
  while (current && chain.length < maxGen) {
    const refId = current.referrer_id
    if (!refId) break
    const ref = nodeMap.get(refId)
    if (!ref) break
    chain.push(refId)
    current = ref
  }
  return chain
}

/** 특정 노드 하위 전체 descendants 반환 */
function getDescendants(rootId: string, nodeMap: Map<string, PayoutNode>): PayoutNode[] {
  const result: PayoutNode[] = []
  const queue = [rootId]
  const seen  = new Set<string>()
  while (queue.length) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    for (const [, node] of nodeMap) {
      if (node.parent_id === id) {
        result.push(node)
        queue.push(node.id)
      }
    }
  }
  return result
}

// ─── 수당 계산 함수 ──────────────────────────────────────────────────────────

/**
 * ① 추천 수당 계산
 *   각 earner의 unpaid_profit × 20% 를 직접 추천인 체인(최대 4단계)에 배분
 *   단, 정지/제명 노드는 수령 불가 (낙전)
 */
export function calcReferralBonus(
  earners:  EarnerItem[],
  nodeMap:  Map<string, PayoutNode>,
): { rows: DistributionRow[]; forfeited: ForfeitedItem[] } {
  const rows:      DistributionRow[] = []
  const forfeited: ForfeitedItem[]   = []

  for (const { profile_id, unpaid_profit } of earners) {
    const chain = getReferrerChain(profile_id, nodeMap, 4)

    chain.forEach((refId, i) => {
      const ref  = nodeMap.get(refId)
      const rate = REFERRAL_RATES[i]
      if (!ref || !rate) return

      const amount = unpaid_profit * rate   // 분윤의 8% / 4% / 4% / 4% 직접 적용

      if (ref.status !== 'active') {
        // 블랭크 노드 → 낙전
        forfeited.push({ profile_id: refId, amount, reason: ref.status as 'suspended' | 'expelled' })
        return
      }

      rows.push({
        source_id:    profile_id,
        recipient_id: refId,
        bonus_type:   'referral',
        amount,
        rate,
        generation:   i + 1,
      })
    })
  }

  return { rows, forfeited }
}

/**
 * ② 직급 수당 계산 (누적 압축 방식)
 *   각 earner의 unpaid_profit × 20% 에서
 *   parent_id 체인을 따라 올라가며 직급별 최초 적격 노드에 배분.
 *   같은 rank 레이어는 한 명만 받음 (compression).
 *   단, 이미 상위 직급을 가진 노드가 있으면 하위 직급 수당도 흡수함 (누적).
 */
export function calcRankBonus(
  earners:  EarnerItem[],
  nodeMap:  Map<string, PayoutNode>,
): { rows: DistributionRow[]; forfeited: ForfeitedItem[] } {
  const rows:      DistributionRow[] = []
  const forfeited: ForfeitedItem[]   = []

  for (const { profile_id, unpaid_profit } of earners) {
    const remainingRanks = new Set(RANK_ORDER)  // R1~R5

    let current = nodeMap.get(profile_id)
    while (current && remainingRanks.size > 0) {
      const upId = current.parent_id
      if (!upId) break
      const up = nodeMap.get(upId)
      if (!up) break

      if (up.rank !== 'R0') {
        const rankIdx = RANK_ORDER.indexOf(up.rank)
        if (rankIdx >= 0) {
          for (let i = 0; i <= rankIdx; i++) {
            const tier = RANK_ORDER[i]
            if (remainingRanks.has(tier)) {
              remainingRanks.delete(tier)
              const rate   = RANK_RATES[tier]
              const amount = unpaid_profit * rate
              if (up.status !== 'active') {
                forfeited.push({ profile_id: upId, amount, reason: up.status as 'suspended' | 'expelled' })
              } else {
                rows.push({
                  source_id:    profile_id,
                  recipient_id: upId,
                  bonus_type:   'rank',
                  amount,
                  rate,
                  generation:   i + 1,
                })
              }
            }
          }
        }
      }

      current = up
    }
  }

  return { rows, forfeited }
}

/**
 * ③ 후원 수당 계산 (바이너리 소실적 8%)
 *   각 노드의 A/B 레그 누적 분윤에서 소실적(약한 레그) × 8%
 *   단, 한 보고서 기간 내 노드당 MAX $20,000
 *
 *   earnerMap: { profileId → unpaid_profit } (이미 합산됨)
 */
export function calcSponsorBonus(
  earners:        EarnerItem[],
  nodeMap:        Map<string, PayoutNode>,
  /**
   * 같은 월에 이미 지급된 후원수당 누계 맵 { profileId → alreadyPaid }
   * 월 MAX $20,000 한도에서 차감하여 이중 초과 방지
   */
  alreadyPaidMap: Map<string, number> = new Map(),
): DistributionRow[] {
  const rows: DistributionRow[] = []

  // 각 프로필의 분윤 합산 맵 (source)
  const profitMap = new Map<string, number>()
  for (const { profile_id, unpaid_profit } of earners) {
    profitMap.set(profile_id, (profitMap.get(profile_id) ?? 0) + unpaid_profit)
  }

  // 각 노드에 대해 A/B 레그 소실적 계산
  const processed = new Set<string>()

  for (const [nodeId, node] of nodeMap) {
    if (node.status !== 'active') continue
    if (processed.has(nodeId)) continue
    processed.add(nodeId)

    const children = [...nodeMap.values()].filter(p => p.parent_id === nodeId)
    const leftChild  = children.find(c => c.leg_position === 'LEFT')
    const rightChild = children.find(c => c.leg_position === 'RIGHT')
    if (!leftChild || !rightChild) continue

    // A/B 레그 하위 전체 분윤 합산
    const sumLegProfit = (legRootId: string): number => {
      const desc = getDescendants(legRootId, nodeMap)
      const legIds = new Set([legRootId, ...desc.map(d => d.id)])
      let total = 0
      for (const id of legIds) {
        total += profitMap.get(id) ?? 0
      }
      return total
    }

    const leftVol  = sumLegProfit(leftChild.id)
    const rightVol = sumLegProfit(rightChild.id)

    if (leftVol <= 0 && rightVol <= 0) continue

    const weakVol  = Math.min(leftVol, rightVol)
    const rawBonus = weakVol * SPONSOR_RATE

    // 월 누계 한도 체크: 이미 지급된 금액을 차감
    const alreadyPaid  = alreadyPaidMap.get(nodeId) ?? 0
    const remaining    = Math.max(0, SPONSOR_MAX_MONTH - alreadyPaid)
    const bonus        = Math.min(rawBonus, remaining)

    if (bonus <= 0) continue

    rows.push({
      source_id:    nodeId,
      recipient_id: nodeId,
      bonus_type:   'sponsor',
      amount:       bonus,
      rate:         SPONSOR_RATE,
      generation:   0,
    })
  }

  return rows
}

/**
 * 전체 수당 계산 (3가지 합산 + 낙전 목록)
 */
export function calcAllBonuses(
  earners:        EarnerItem[],
  nodeMap:        Map<string, PayoutNode>,
  alreadyPaidMap: Map<string, number> = new Map(),
): { distributions: DistributionRow[]; forfeited: ForfeitedItem[] } {
  const referral = calcReferralBonus(earners, nodeMap)
  const rank     = calcRankBonus(earners, nodeMap)
  const sponsor  = calcSponsorBonus(earners, nodeMap, alreadyPaidMap)

  return {
    distributions: [...referral.rows, ...rank.rows, ...sponsor],
    forfeited:     [...referral.forfeited, ...rank.forfeited],
  }
}

/**
 * recipient_id별 수당 합산 (지급 요약용)
 */
export function summarizeByRecipient(
  rows: DistributionRow[],
): Map<string, { referral: number; rank: number; sponsor: number; total: number }> {
  const map = new Map<string, { referral: number; rank: number; sponsor: number; total: number }>()

  for (const row of rows) {
    const cur = map.get(row.recipient_id) ?? { referral: 0, rank: 0, sponsor: 0, total: 0 }
    cur[row.bonus_type] += row.amount
    cur.total += row.amount
    map.set(row.recipient_id, cur)
  }

  return map
}
