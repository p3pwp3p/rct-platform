/**
 * GET /api/admin/node-control
 *
 * 노드 통제 현황: 회원 계정별 Vantage 잔고 / 허용노드 / 현재 노드 상태(활성·정지예정·정지).
 * member_accounts + profiles 를 owner 기준으로 조인해 관리자에게 보여준다.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
    const { data: u } = await admin.auth.getUser(token)
    if (u.user?.app_metadata?.role !== 'admin') return NextResponse.json({ error: '관리자 권한 필요' }, { status: 401 })

    const { data: accounts } = await admin
      .from('member_accounts')
      .select('user_id, vantage_ct, fee_balance, allowed_nodes, is_exempt, balance_synced_at')
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, node_id, name, owner_id, status, pending_action, grace_until')

    const nodesByOwner = new Map<string, { node_id: string; name: string; status: string; pending: string | null; graceUntil: string | null }[]>()
    for (const p of (profiles ?? [])) {
      if (!p.owner_id) continue
      if (!nodesByOwner.has(p.owner_id)) nodesByOwner.set(p.owner_id, [])
      nodesByOwner.get(p.owner_id)!.push({
        node_id: p.node_id, name: p.name, status: p.status,
        pending: p.pending_action, graceUntil: p.grace_until,
      })
    }

    const rows = (accounts ?? []).map(a => {
      const nodes = (nodesByOwner.get(a.user_id) ?? []).slice().sort((x, y) => x.node_id.localeCompare(y.node_id))
      const active = nodes.filter(n => n.status === 'active').length
      const suspended = nodes.filter(n => n.status === 'suspended').length
      const pending = nodes.filter(n => n.pending === 'suspend').length
      const name = nodes[0]?.name ?? null
      const overLimit = !a.is_exempt && a.allowed_nodes != null && active > a.allowed_nodes
      return {
        vantageCt: a.vantage_ct, name, feeBalance: a.fee_balance,
        allowedNodes: a.is_exempt ? null : a.allowed_nodes, isExempt: a.is_exempt,
        activeNodes: active, suspendedNodes: suspended, pendingNodes: pending,
        overLimit, syncedAt: a.balance_synced_at,
        nodes,
      }
    }).sort((a, b) => {
      // 조치필요(초과/예정/정지) 먼저
      const sev = (r: typeof a) => (r.overLimit ? 3 : 0) + (r.pendingNodes ? 2 : 0) + (r.suspendedNodes ? 1 : 0)
      return sev(b) - sev(a)
    })

    return NextResponse.json({
      rows,
      summary: {
        accounts: rows.length,
        exempt: rows.filter(r => r.isExempt).length,
        overLimit: rows.filter(r => r.overLimit).length,
        withPending: rows.filter(r => r.pendingNodes > 0).length,
        withSuspended: rows.filter(r => r.suspendedNodes > 0).length,
        neverSynced: rows.filter(r => !r.syncedAt).length,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '조회 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
