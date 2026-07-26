import { describe, it, expect } from 'vitest'
import { computeAllowedNodes, planEnforcement, type EnforceNode } from './node-enforcement'

const DAY = 86400_000
const NOW = Date.parse('2026-07-10T00:00:00Z')
const node = (node_id: string, over: Partial<EnforceNode> = {}): EnforceNode => ({
  id: 'id-' + node_id, node_id, status: 'active', pending_action: null, grace_until: null, ...over,
})

describe('computeAllowedNodes', () => {
  it('예외회원은 무제한(null)', () => {
    expect(computeAllowedNodes({ feeBalance: 100, isExempt: true, graceByDeposit: true })).toBeNull()
  })
  it('엄격 모드: floor(잔고/3000)', () => {
    expect(computeAllowedNodes({ feeBalance: 6500, isExempt: false, graceByDeposit: false })).toBe(2)
    expect(computeAllowedNodes({ feeBalance: 2999, isExempt: false, graceByDeposit: false })).toBe(0)
  })
  it('유예 모드: 예치금(잔고-실현손익) 기준도 인정(더 큰 값)', () => {
    // 잔고 2966, 실현 -335 → 예치 ≈3301 → 1 (엄격은 0)
    expect(computeAllowedNodes({ feeBalance: 2966, realizedProfit: -335, isExempt: false, graceByDeposit: true })).toBe(1)
  })
  it('유예 모드라도 이익난 계정은 엄격과 동일', () => {
    // 잔고 2798, 실현 +293 → 예치 ≈2505 → 0
    expect(computeAllowedNodes({ feeBalance: 2798, realizedProfit: 293, isExempt: false, graceByDeposit: true })).toBe(0)
  })
})

describe('planEnforcement', () => {
  it('예외회원은 아무 조치 없음', () => {
    const r = planEnforcement({ allowed: null, isExempt: true, nodes: [node('RCT-1'), node('RCT-2')], feeBalance: 100, nowMs: NOW })
    expect(r.action).toBe('none'); expect(r.updates).toHaveLength(0)
  })

  it('한도 내 정상 → 조치 없음', () => {
    const r = planEnforcement({ allowed: 2, isExempt: false, nodes: [node('RCT-1'), node('RCT-2')], feeBalance: 6000, nowMs: NOW })
    expect(r.action).toBe('none'); expect(r.updates).toHaveLength(0)
  })

  it('초과 → 뒤쪽 노드부터 7일 예고 시작(즉시 정지 아님)', () => {
    const r = planEnforcement({ allowed: 1, isExempt: false, nodes: [node('RCT-1'), node('RCT-2'), node('RCT-3')], feeBalance: 3500, nowMs: NOW })
    expect(r.action).toBe('grace_start')
    expect(r.affected).toEqual(['RCT-2', 'RCT-3'])   // 낮은 것(RCT-1) 유지, 뒤쪽 정지 예고
    expect(r.updates.every(u => u.action === 'grace_start' && u.set.pending_action === 'suspend')).toBe(true)
    expect(r.updates).toHaveLength(2)
  })

  it('예고 유예 만료 → 실제 정지', () => {
    const expired = node('RCT-2', { pending_action: 'suspend', grace_until: new Date(NOW - DAY).toISOString() })
    const r = planEnforcement({ allowed: 1, isExempt: false, nodes: [node('RCT-1'), expired], feeBalance: 2000, nowMs: NOW })
    expect(r.action).toBe('suspend')
    expect(r.updates[0].set.status).toBe('suspended')
  })

  it('예고 진행 중(만료 전) → 무변화(업데이트 없음)', () => {
    const pending = node('RCT-2', { pending_action: 'suspend', grace_until: new Date(NOW + 3 * DAY).toISOString() })
    const r = planEnforcement({ allowed: 1, isExempt: false, nodes: [node('RCT-1'), pending], feeBalance: 2000, nowMs: NOW })
    expect(r.action).toBe('grace_start')
    expect(r.affected).toContain('RCT-2')
    expect(r.updates).toHaveLength(0)          // 이미 예고 중이라 DB 변경 없음
  })

  it('잔고 회복 → 예고 해제(grace_cancel)', () => {
    const pending = node('RCT-1', { pending_action: 'suspend', grace_until: new Date(NOW + 3 * DAY).toISOString() })
    const r = planEnforcement({ allowed: 1, isExempt: false, nodes: [pending], feeBalance: 3200, nowMs: NOW })
    expect(r.action).toBe('grace_cancel')
    expect(r.updates[0].set.pending_action).toBeNull()
  })

  it('여유 생기고 정지 노드 있음 → 재활성', () => {
    const susp = node('RCT-2', { status: 'suspended' })
    const r = planEnforcement({ allowed: 2, isExempt: false, nodes: [node('RCT-1'), susp], feeBalance: 6000, nowMs: NOW })
    expect(r.action).toBe('reactivate')
    expect(r.updates[0].set.status).toBe('active')
  })

  it('제명(expelled) 노드는 재활성 대상 아님', () => {
    const exp = node('RCT-2', { status: 'expelled' })
    const r = planEnforcement({ allowed: 5, isExempt: false, nodes: [node('RCT-1'), exp], feeBalance: 15000, nowMs: NOW })
    expect(r.action).toBe('none')
    expect(r.updates).toHaveLength(0)
  })
})
