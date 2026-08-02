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
import { logAudit } from '@/lib/audit'
import { rateLimit, clientIp, tooMany } from '@/lib/rate-limit'
import { computeAllowedNodes, planEnforcement } from '@/lib/node-enforcement'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

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
    // 동기화 스크립트가 매시간 정상 호출하므로 넉넉하게 — 폭주만 막는 수준
    if (!await rateLimit(`import-copiers:${clientIp(req)}`, 30, 60)) {
      return NextResponse.json(tooMany, { status: 429 })
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

      const allowed = computeAllowedNodes({
        feeBalance: bal, realizedProfit: c.realizedProfit, isExempt: acc.is_exempt, graceByDeposit,
      })

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
      const active = nodes.filter(n => n.status === 'active')

      // ── 순수 함수로 조치 결정 → apply 시 실제 반영 ──
      const plan = planEnforcement({ allowed, isExempt: acc.is_exempt, nodes, feeBalance: bal, nowMs: Date.now() })
      if (apply) {
        for (const u of plan.updates) {
          await admin.from('profiles').update(u.set).eq('id', u.id)
          notifications.push({ profileId: u.id, type: 'system', title: u.notify.title, body: u.notify.body })
        }
      }

      recon.push({
        vantageCt: ct, userId: acc.user_id, name: active[0]?.name ?? nodes[0]?.name ?? null,
        feeBalance: bal, allowedNodes: allowed, activeNodes: active.length,
        action: plan.action, affectedNodeIds: plan.affected,
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

    // 실제 적용 시에만 감사로그 (통제 작업 = 기록). 크롤러(내부호출)면 actor=crawler.
    if (apply) {
      const internal = isInternalCall(req)
      const tok = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
      const { data: actor } = tok ? await admin.auth.getUser(tok) : { data: { user: null } }
      await logAudit({
        actorId: actor.user?.id ?? null,
        actorEmail: actor.user?.email ?? (internal ? 'crawler(internal)' : null),
        action: 'import_copiers',
        targetType: 'node_control', targetId: null,
        detail: { ...summary, graceByDeposit },
      })
    }

    return NextResponse.json({ summary, reconciliation: recon })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '임포트 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
