import { describe, it, expect } from 'vitest'
import {
  calcReferralBonus,
  calcRankBonus,
  calcSponsorBonus,
  calcAllBonuses,
  summarizeByRecipient,
  type PayoutNode,
  type EarnerItem,
  type DistributionRow,
} from './payout-engine'

// ─── 픽스처 헬퍼 ──────────────────────────────────────────────────────────────
function node(id: string, o: Partial<PayoutNode> = {}): PayoutNode {
  return {
    id,
    rank:         o.rank ?? 'R0',
    status:       o.status ?? 'active',
    parent_id:    o.parent_id ?? null,
    referrer_id:  o.referrer_id ?? null,
    leg_position: o.leg_position ?? null,
  }
}
function mapOf(...nodes: PayoutNode[]) {
  return new Map(nodes.map(n => [n.id, n]))
}
const sum = (rows: DistributionRow[]) => rows.reduce((s, r) => s + r.amount, 0)

// ─── ① 추천 수당 ──────────────────────────────────────────────────────────────
describe('calcReferralBonus', () => {
  it('4대 체인에 8/4/4/4 비율로 분배 (합 20%)', () => {
    const nodes = mapOf(
      node('E', { referrer_id: 'A' }),
      node('A', { referrer_id: 'B' }),
      node('B', { referrer_id: 'C' }),
      node('C', { referrer_id: 'D' }),
      node('D', { referrer_id: null }),
    )
    const { rows, forfeited } = calcReferralBonus([{ profile_id: 'E', unpaid_profit: 1000 }], nodes)
    expect(forfeited).toHaveLength(0)
    expect(rows.map(r => [r.recipient_id, r.generation, r.amount])).toEqual([
      ['A', 1, expect.closeTo(80, 6)],
      ['B', 2, expect.closeTo(40, 6)],
      ['C', 3, expect.closeTo(40, 6)],
      ['D', 4, expect.closeTo(40, 6)],
    ])
    expect(sum(rows)).toBeCloseTo(200, 6) // 분윤의 20%
  })

  it('체인이 4대보다 짧으면 있는 만큼만 지급', () => {
    const nodes = mapOf(
      node('E', { referrer_id: 'A' }),
      node('A', { referrer_id: null }),
    )
    const { rows } = calcReferralBonus([{ profile_id: 'E', unpaid_profit: 1000 }], nodes)
    expect(rows).toHaveLength(1)
    expect(rows[0].amount).toBeCloseTo(80, 6)
  })

  it('추천인이 없으면 아무 행도 생성하지 않음', () => {
    const nodes = mapOf(node('E', { referrer_id: null }))
    const { rows, forfeited } = calcReferralBonus([{ profile_id: 'E', unpaid_profit: 1000 }], nodes)
    expect(rows).toHaveLength(0)
    expect(forfeited).toHaveLength(0)
  })

  it('정지/제명 추천인의 몫은 낙전 처리되고, 더 윗선은 정상 지급', () => {
    const nodes = mapOf(
      node('E', { referrer_id: 'A' }),
      node('A', { referrer_id: 'B', status: 'suspended' }),
      node('B', { referrer_id: null }),
    )
    const { rows, forfeited } = calcReferralBonus([{ profile_id: 'E', unpaid_profit: 1000 }], nodes)
    expect(forfeited).toEqual([{ profile_id: 'A', amount: expect.closeTo(80, 6), reason: 'suspended' }])
    expect(rows.map(r => r.recipient_id)).toEqual(['B'])
    expect(rows[0].amount).toBeCloseTo(40, 6) // 2대 4%
  })
})

// ─── ② 직급 수당 ──────────────────────────────────────────────────────────────
describe('calcRankBonus', () => {
  it('상위 직급자는 하위 tier 풀도 함께 수령 (풀 균등분배)', () => {
    // 전체 분윤 1000. 풀: R1=80, R2=40, R3=20, R4=10, R5=5
    const nodes = mapOf(
      node('one', { rank: 'R1' }),
      node('three', { rank: 'R3' }),
    )
    const { rows, forfeited, companyForfeited } = calcRankBonus(
      [{ profile_id: 'x', unpaid_profit: 1000 }], nodes,
    )
    const byRcpt = summarizeByRecipient(rows)
    // R1 tier(80) → one,three 균등 40씩 / R2(40)→three / R3(20)→three
    expect(byRcpt.get('one')!.rank).toBeCloseTo(40, 6)
    expect(byRcpt.get('three')!.rank).toBeCloseTo(40 + 40 + 20, 6) // 100
    // R4(10)+R5(5) 적격자 없음 → 회사 귀속
    expect(companyForfeited).toBeCloseTo(15, 6)
    expect(forfeited).toHaveLength(0)
    // 보존: 분배 + 낙전 = 전체 직급 풀 15.5%
    expect(sum(rows) + companyForfeited).toBeCloseTo(155, 6)
  })

  it('정지 직급자도 분모에 포함되며 그 몫은 낙전 (재분배 안 함)', () => {
    const nodes = mapOf(
      node('act', { rank: 'R1' }),
      node('susp', { rank: 'R1', status: 'suspended' }),
    )
    const { rows, forfeited, companyForfeited } = calcRankBonus(
      [{ profile_id: 'x', unpaid_profit: 1000 }], nodes,
    )
    // R1 풀 80, 적격 2명(정지 포함) → 각 40. act는 지급, susp는 낙전
    expect(rows).toHaveLength(1)
    expect(rows[0].recipient_id).toBe('act')
    expect(rows[0].amount).toBeCloseTo(40, 6)
    expect(forfeited).toEqual([{ profile_id: 'susp', amount: expect.closeTo(40, 6), reason: 'suspended' }])
    // R2~R5 적격자 없음 → 40+20+10+5
    expect(companyForfeited).toBeCloseTo(75, 6)
  })

  it('R0만 있으면 적격자 0명 → 전체 직급 풀이 회사 귀속', () => {
    const nodes = mapOf(node('a', { rank: 'R0' }), node('b', { rank: 'R0' }))
    const { rows, companyForfeited } = calcRankBonus([{ profile_id: 'a', unpaid_profit: 1000 }], nodes)
    expect(rows).toHaveLength(0)
    expect(companyForfeited).toBeCloseTo(155, 6) // 8+4+2+1+0.5 %
  })

  it('분윤 합계가 0 이하이면 빈 결과', () => {
    const nodes = mapOf(node('a', { rank: 'R3' }))
    const r = calcRankBonus([{ profile_id: 'a', unpaid_profit: 0 }], nodes)
    expect(r.rows).toHaveLength(0)
    expect(r.companyForfeited).toBe(0)
  })
})

// ─── ③ 후원 수당 ──────────────────────────────────────────────────────────────
describe('calcSponsorBonus', () => {
  // P ─┬─ L(LEFT) ── L2
  //    └─ R(RIGHT)
  const buildBinary = () => mapOf(
    node('P'),
    node('L',  { parent_id: 'P', leg_position: 'LEFT' }),
    node('L2', { parent_id: 'L' }),
    node('R',  { parent_id: 'P', leg_position: 'RIGHT' }),
  )

  it('소실적(약한 레그) × 8% 를 후원 노드에 지급', () => {
    const earners: EarnerItem[] = [
      { profile_id: 'L2', unpaid_profit: 1000 }, // left leg = 1000
      { profile_id: 'R',  unpaid_profit: 600 },  // right leg = 600
    ]
    const rows = calcSponsorBonus(earners, buildBinary())
    const pRow = rows.find(r => r.recipient_id === 'P')!
    expect(pRow.amount).toBeCloseTo(600 * 0.08, 6) // weak=600 → 48
  })

  it('월 $20,000 한도: 이미 지급분을 차감해 잔여만 지급', () => {
    const earners: EarnerItem[] = [
      { profile_id: 'L2', unpaid_profit: 1_000_000 },
      { profile_id: 'R',  unpaid_profit: 1_000_000 },
    ]
    // raw = 1,000,000 * 0.08 = 80,000 이지만 이미 19,980 지급 → 잔여 20만
    const rows = calcSponsorBonus(earners, buildBinary(), new Map([['P', 19_980]]))
    const pRow = rows.find(r => r.recipient_id === 'P')!
    expect(pRow.amount).toBeCloseTo(20, 6)
  })

  it('월 한도 이미 소진 시 지급 행 없음', () => {
    const earners: EarnerItem[] = [
      { profile_id: 'L2', unpaid_profit: 1000 },
      { profile_id: 'R',  unpaid_profit: 600 },
    ]
    const rows = calcSponsorBonus(earners, buildBinary(), new Map([['P', 20_000]]))
    expect(rows.find(r => r.recipient_id === 'P')).toBeUndefined()
  })

  it('한쪽 레그가 없으면 후원 수당 없음', () => {
    const nodes = mapOf(
      node('P'),
      node('L', { parent_id: 'P', leg_position: 'LEFT' }),
    )
    const rows = calcSponsorBonus([{ profile_id: 'L', unpaid_profit: 1000 }], nodes)
    expect(rows.find(r => r.recipient_id === 'P')).toBeUndefined()
  })

  it('정지된 후원 노드는 건너뜀', () => {
    const nodes = buildBinary()
    nodes.get('P')!.status = 'suspended'
    const earners: EarnerItem[] = [
      { profile_id: 'L2', unpaid_profit: 1000 },
      { profile_id: 'R',  unpaid_profit: 600 },
    ]
    const rows = calcSponsorBonus(earners, nodes)
    expect(rows.find(r => r.recipient_id === 'P')).toBeUndefined()
  })
})

// ─── 통합 + 요약 ──────────────────────────────────────────────────────────────
describe('calcAllBonuses & summarizeByRecipient', () => {
  it('세 수당을 합치고 recipient별로 집계', () => {
    const nodes = mapOf(
      node('P', { rank: 'R1' }),
      node('L',  { parent_id: 'P', leg_position: 'LEFT', referrer_id: 'P' }),
      node('R',  { parent_id: 'P', leg_position: 'RIGHT', referrer_id: 'P' }),
    )
    const earners: EarnerItem[] = [
      { profile_id: 'L', unpaid_profit: 1000 },
      { profile_id: 'R', unpaid_profit: 1000 },
    ]
    const { distributions } = calcAllBonuses(earners, nodes)
    const byRcpt = summarizeByRecipient(distributions)
    const p = byRcpt.get('P')!
    // 추천: L,R 각각 1대 8% → 80+80 = 160
    expect(p.referral).toBeCloseTo(160, 6)
    // 직급: R1 풀 = 2000*0.08 = 160, 적격 1명(P) → 160
    expect(p.rank).toBeCloseTo(160, 6)
    // 후원: 양 레그 1000/1000 소실적 1000*8% = 80
    expect(p.sponsor).toBeCloseTo(80, 6)
    expect(p.total).toBeCloseTo(160 + 160 + 80, 6)
  })

  it('summarizeByRecipient: 빈 입력은 빈 맵', () => {
    expect(summarizeByRecipient([]).size).toBe(0)
  })
})
