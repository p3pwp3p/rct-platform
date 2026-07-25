/**
 * POST /api/admin/import-copiers
 *
 * 크롤러가 긁은 카피자 잔고를 받아:
 *  1) member_accounts.fee_balance / allowed_nodes 갱신
 *  2) (apply=true 일 때) 초과 노드 자동 정지(status='suspended'),
 *     잔고 복구 시 재활성(status='active'). 예외회원(is_exempt)은 통제 제외.
 *
 * 인증: 내부 시크릿(x-internal-secret) 또는 관리자 토큰.
 * body: {
 *   copiers: [{ vantageCt: string, feeBalance: number, realizedProfit?: number }],
 *   apply?: boolean   // false(기본)=시뮬레이션(리포트만), true=실제 정지/재활성 적용
 * }
 *
 * 안전장치: apply 기본값 false. 처음엔 리포트로 영향 범위를 확인한 뒤 apply=true.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isInternalCall } from '@/lib/internal-auth'
import { createNotifications } from '@/lib/notify'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const MIN_PER_NODE = 3000
const GRACE_DAYS = 7

async function isAdminToken(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  if (!token) return false
  const { data } = await admin.auth.getUser(token)
  return data.user?.app_metadata?.role === 'admin'
}

type Copier = { vantageCt: string; feeBalance: number; realizedProfit?: number }
type ReconRow = {
  vantageCt: string
  userId: string | null
  name: string | null
  feeBalance: number
  allowedNodes: number | null
  activeNodes: number
  action: 'none' | 'grace_start' | 'suspend' | 'reactivate' | 'grace_cancel' | 'unmatched'
  affectedNodeIds: string[]
}

export async function POST(req: NextRequest) {
  try {
    if (!isInternalCall(req) && !await isAdminToken(req)) {
      return NextResponse.json({ error: '권한 필요' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const copiers: Copier[] = Array.isArray(body.copiers) ? body.copiers : []
    const apply: boolean = body.apply === true
    // 초기 유예: 추정 예치금(잔고-실현손익) 기준으로도 허용노드를 인정.
    // 손실로 잔고가 3000 밑이어도 원래 3000 이상 예치했으면 유지. (기본 ON, 나중에 끌 수 있음)
    const graceByDeposit: boolean = body.graceByDeposit !== false
    if (copiers.length === 0) {
      return NextResponse.json({ error: 'copiers 배열 필요' }, { status: 400 })
    }

    // 계정 매핑 로드
    const { data: accounts } = await admin
      .from('member_accounts')
      .select('user_id, vantage_ct, is_exempt')
    const byCt = new Map((accounts ?? []).map(a => [String(a.vantage_ct), a]))

    // 모든 프로필(노드) 로드 — 소유자별 노드 상태 집계
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, node_id, name, owner_id, status, pending_action, grace_until')
    type Node = { id: string; node_id: string; name: string; status: string; pending_action: string | null; grace_until: string | null }
    const nodesByOwner = new Map<string, Node[]>()
    for (const p of (profiles ?? [])) {
      const k = p.owner_id
      if (!k) continue
      if (!nodesByOwner.has(k)) nodesByOwner.set(k, [])
      nodesByOwner.get(k)!.push(p)
    }

    const recon: ReconRow[] = []
    const notifications: { profileId: string; type: 'system'; title: string; body: string }[] = []

    for (const c of copiers) {
      const ct = String(c.vantageCt).trim()
      const bal = Number(c.feeBalance)
      const acc = byCt.get(ct)

      if (!acc) {
        recon.push({ vantageCt: ct, userId: null, name: null, feeBalance: bal,
          allowedNodes: null, activeNodes: 0, action: 'unmatched', affectedNodeIds: [] })
        continue
      }

      // 허용노드 = floor(잔고/3000). 유예 ON 이면 추정예치금(잔고-실현손익) 기준도 인정(더 큰 값).
      const strictAllowed = Math.floor(bal / MIN_PER_NODE)
      const realized = Number.isFinite(Number(c.realizedProfit)) ? Number(c.realizedProfit) : 0
      const depositAllowed = Math.floor((bal - realized) / MIN_PER_NODE)
      const allowed = acc.is_exempt
        ? null
        : (graceByDeposit ? Math.max(strictAllowed, depositAllowed) : strictAllowed)

      // 잔고/허용노드 갱신
      if (apply) {
        await admin.from('member_accounts').update({
          fee_balance: bal,
          allowed_nodes: allowed,
          balance_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('user_id', acc.user_id)
      }

      const nodes = (nodesByOwner.get(acc.user_id) ?? [])
        .slice()
        .sort((a, b) => a.node_id.localeCompare(b.node_id))   // 낮은 node_id(=메인) 우선
      const active = nodes.filter(n => n.status === 'active')
      const suspended = nodes.filter(n => n.status === 'suspended')  // expelled 는 건드리지 않음

      let action: ReconRow['action'] = 'none'
      const affected: string[] = []
      const now = Date.now()
      const graceUntilIso = new Date(now + GRACE_DAYS * 86400_000).toISOString()

      if (acc.is_exempt) {
        action = 'none'                                 // 예외회원: 통제 제외
      } else if (active.length > (allowed ?? 0)) {
        // 초과 → 뒤쪽(높은 node_id, 최근) 노드부터 대상. 즉시 정지가 아니라 "예고 후 정지".
        const excess = active.slice(allowed ?? 0)
        for (const n of excess) {
          const graceExpired = n.pending_action === 'suspend' && n.grace_until != null
            && new Date(n.grace_until).getTime() <= now
          if (n.pending_action !== 'suspend') {
            // 1단계: 유예 예고 시작 (7일)
            action = 'grace_start'; affected.push(n.node_id)
            if (apply) {
              await admin.from('profiles').update({
                pending_action: 'suspend', grace_until: graceUntilIso,
                pending_reason: `증거금 부족(${Math.round(bal).toLocaleString('ko-KR')}$)`,
              }).eq('id', n.id)
              notifications.push({ profileId: n.id, type: 'system',
                title: `${n.node_id} 노드 정지 예정 안내`,
                body: `증거금 부족으로 ${GRACE_DAYS}일 후 정지됩니다. 그 전에 증거금을 3,000$ 이상으로 보충하세요.` })
            }
          } else if (graceExpired) {
            // 2단계: 유예 만료 → 실제 정지
            action = 'suspend'; affected.push(n.node_id)
            if (apply) {
              await admin.from('profiles').update({
                status: 'suspended', pending_action: null, grace_until: null, pending_reason: null,
              }).eq('id', n.id)
              notifications.push({ profileId: n.id, type: 'system',
                title: `${n.node_id} 노드가 정지되었습니다`,
                body: `증거금 미충족으로 정지됨. 증거금 보충 시 자동 해제됩니다.` })
            }
          } else {
            // 유예 진행 중 — 변화 없음
            if (action === 'none') action = 'grace_start'
            affected.push(n.node_id)
          }
        }
      } else {
        // 한도 내 — 예고 걸린 노드가 있으면 예고 해제(회복)
        const pendingActive = active.filter(n => n.pending_action === 'suspend')
        if (pendingActive.length) {
          action = 'grace_cancel'
          for (const n of pendingActive) {
            affected.push(n.node_id)
            if (apply) {
              await admin.from('profiles').update({
                pending_action: null, grace_until: null, pending_reason: null,
              }).eq('id', n.id)
              notifications.push({ profileId: n.id, type: 'system',
                title: `${n.node_id} 노드 정지 예정 해제`,
                body: `증거금이 회복되어 정지 예정이 취소되었습니다.` })
            }
          }
        }
        // 여유가 생겼고 정지된 노드가 있으면 재활성
        const slots = (allowed ?? 0) - active.length
        if (slots > 0 && suspended.length) {
          const toReactivate = suspended.slice(0, slots)
          action = 'reactivate'
          for (const n of toReactivate) affected.push(n.node_id)
          if (apply) {
            await admin.from('profiles').update({ status: 'active' })
              .in('id', toReactivate.map(n => n.id))
            for (const n of toReactivate) {
              notifications.push({ profileId: n.id, type: 'system',
                title: `${n.node_id} 노드가 재활성되었습니다`,
                body: `증거금 보충으로 다시 활성화되었습니다.` })
            }
          }
        }
      }

      recon.push({
        vantageCt: ct, userId: acc.user_id, name: active[0]?.name ?? nodes[0]?.name ?? null,
        feeBalance: bal, allowedNodes: allowed, activeNodes: active.length,
        action, affectedNodeIds: affected,
      })
    }

    if (apply && notifications.length) {
      await createNotifications(notifications)
    }

    const summary = {
      applied: apply,
      total: recon.length,
      matched: recon.filter(r => r.action !== 'unmatched').length,
      unmatched: recon.filter(r => r.action === 'unmatched').length,
      graceStart: recon.filter(r => r.action === 'grace_start').length,
      toSuspend: recon.filter(r => r.action === 'suspend').length,
      graceCancel: recon.filter(r => r.action === 'grace_cancel').length,
      toReactivate: recon.filter(r => r.action === 'reactivate').length,
    }
    return NextResponse.json({ summary, reconciliation: recon })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '임포트 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
