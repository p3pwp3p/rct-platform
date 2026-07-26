/**
 * 노드 통제 결정 로직 (순수 함수) — DB/부수효과 없이 "무엇을 할지"만 계산.
 * import-copiers 라우트가 이걸 호출해 실제 DB 갱신/알림을 수행한다. 단위테스트 대상.
 */

export const MIN_PER_NODE = 3000
export const GRACE_DAYS = 7

export type EnforceNode = {
  id: string
  node_id: string
  status: string                 // 'active' | 'suspended' | 'expelled'
  pending_action: string | null  // 'suspend' | null
  grace_until: string | null     // ISO | null
}

export type EnforceAction = 'none' | 'grace_start' | 'suspend' | 'grace_cancel' | 'reactivate'

export type NodeUpdate = {
  id: string
  node_id: string
  action: Exclude<EnforceAction, 'none'>
  set: Record<string, string | null>          // profiles 갱신 필드
  notify: { title: string; body: string }
}

/**
 * 허용 노드 수 = floor(잔고 / 3000).
 * 예외회원은 null(무제한). graceByDeposit 이면 추정예치금(잔고-실현손익) 기준도 인정(더 큰 값).
 */
export function computeAllowedNodes(opts: {
  feeBalance: number
  realizedProfit?: number
  isExempt: boolean
  graceByDeposit: boolean
  minPerNode?: number
}): number | null {
  if (opts.isExempt) return null
  const min = opts.minPerNode ?? MIN_PER_NODE
  const strict = Math.floor(opts.feeBalance / min)
  if (!opts.graceByDeposit) return strict
  const realized = Number.isFinite(Number(opts.realizedProfit)) ? Number(opts.realizedProfit) : 0
  const byDeposit = Math.floor((opts.feeBalance - realized) / min)
  return Math.max(strict, byDeposit)
}

/**
 * 한 계정의 노드 상태 + 허용노드 수 → 실행할 조치 목록.
 * - 초과 active 노드: 예고 시작(grace_start) → (유예 만료 시) 정지(suspend), 진행 중이면 무변화
 * - 한도 내 예고 노드: 예고 해제(grace_cancel)
 * - 여유 있고 정지 노드: 재활성(reactivate)  (expelled 는 절대 건드리지 않음)
 */
export function planEnforcement(opts: {
  allowed: number | null
  isExempt: boolean
  nodes: EnforceNode[]
  feeBalance: number
  nowMs: number
  graceDays?: number
}): { action: EnforceAction; affected: string[]; updates: NodeUpdate[] } {
  const { allowed, isExempt, feeBalance, nowMs } = opts
  const graceDays = opts.graceDays ?? GRACE_DAYS
  const graceUntilIso = new Date(nowMs + graceDays * 86400_000).toISOString()
  const reason = `증거금 부족(${Math.round(feeBalance).toLocaleString('ko-KR')}$)`

  const nodes = opts.nodes.slice().sort((a, b) => a.node_id.localeCompare(b.node_id))
  const active = nodes.filter(n => n.status === 'active')
  const suspended = nodes.filter(n => n.status === 'suspended')  // expelled 제외

  let action: EnforceAction = 'none'
  const affected: string[] = []
  const updates: NodeUpdate[] = []
  const cap = allowed ?? 0

  if (isExempt) return { action: 'none', affected, updates }

  if (active.length > cap) {
    const excess = active.slice(cap)          // 뒤쪽(높은 node_id)부터 초과분
    for (const n of excess) {
      const graceExpired = n.pending_action === 'suspend' && n.grace_until != null
        && new Date(n.grace_until).getTime() <= nowMs
      if (n.pending_action !== 'suspend') {
        action = 'grace_start'; affected.push(n.node_id)
        updates.push({
          id: n.id, node_id: n.node_id, action: 'grace_start',
          set: { pending_action: 'suspend', grace_until: graceUntilIso, pending_reason: reason },
          notify: { title: `${n.node_id} 노드 정지 예정 안내`, body: `증거금 부족으로 ${graceDays}일 후 정지됩니다. 그 전에 증거금을 3,000$ 이상으로 보충하세요.` },
        })
      } else if (graceExpired) {
        action = 'suspend'; affected.push(n.node_id)
        updates.push({
          id: n.id, node_id: n.node_id, action: 'suspend',
          set: { status: 'suspended', pending_action: null, grace_until: null, pending_reason: null },
          notify: { title: `${n.node_id} 노드가 정지되었습니다`, body: '증거금 미충족으로 정지됨. 증거금 보충 시 자동 해제됩니다.' },
        })
      } else {
        if (action === 'none') action = 'grace_start'   // 유예 진행 중 — 무변화
        affected.push(n.node_id)
      }
    }
  } else {
    const pendingActive = active.filter(n => n.pending_action === 'suspend')
    if (pendingActive.length) {
      action = 'grace_cancel'
      for (const n of pendingActive) {
        affected.push(n.node_id)
        updates.push({
          id: n.id, node_id: n.node_id, action: 'grace_cancel',
          set: { pending_action: null, grace_until: null, pending_reason: null },
          notify: { title: `${n.node_id} 노드 정지 예정 해제`, body: '증거금이 회복되어 정지 예정이 취소되었습니다.' },
        })
      }
    }
    const slots = cap - active.length
    if (slots > 0 && suspended.length) {
      const toReactivate = suspended.slice(0, slots)
      action = 'reactivate'
      for (const n of toReactivate) {
        affected.push(n.node_id)
        updates.push({
          id: n.id, node_id: n.node_id, action: 'reactivate',
          set: { status: 'active' },
          notify: { title: `${n.node_id} 노드가 재활성되었습니다`, body: '증거금 보충으로 다시 활성화되었습니다.' },
        })
      }
    }
  }

  return { action, affected, updates }
}
