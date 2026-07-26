'use client'
import { Fragment, useState } from 'react'
import { useApi } from '@/lib/swr'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ToastProvider'

type Node = { id: string; node_id: string; name: string; status: string; pending: string | null; graceUntil: string | null; reason: string | null }
type Row = {
  vantageCt: string; name: string | null; feeBalance: number | null
  allowedNodes: number | null; isExempt: boolean
  activeNodes: number; suspendedNodes: number; pendingNodes: number
  overLimit: boolean; syncedAt: string | null; nodes: Node[]
}
type Data = {
  rows: Row[]
  summary: { accounts: number; exempt: number; overLimit: number; withPending: number; withSuspended: number; neverSynced: number }
}

function fmtDate(iso: string | null) {
  if (!iso) return '동기화 안됨'
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function daysLeft(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  return ms <= 0 ? 0 : Math.ceil(ms / 86400_000)
}
const STATUS: Record<string, { t: string; c: string }> = {
  active:    { t: '활성', c: '#34d399' },
  suspended: { t: '정지', c: '#f87171' },
  expelled:  { t: '제명', c: '#a78bfa' },
}

export default function NodeControlPage() {
  const toast = useToast()
  const { data, isLoading, error, mutate } = useApi<Data>('/api/admin/node-control')
  const rows = data?.rows ?? []
  const s = data?.summary
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState('')

  async function act(nodeId: string, action: string, confirmMsg: string) {
    if (!confirm(confirmMsg)) return
    setBusy(nodeId + action)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/node-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ nodeId, action }),
      })
      const j = await res.json()
      if (!res.ok) { toast(j.error ?? '오류', 'error'); return }
      toast('처리했습니다', 'success')
      mutate()
    } finally { setBusy('') }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24, fontFamily: 'var(--font-main)' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>노드 통제 현황</h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
        회원 계정별 Vantage 수수료 잔고와 허용 노드 수(잔고/3,000), 노드 상태. 행을 클릭하면 노드별 상세·조치.
      </p>

      {s && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <Stat label="계정" value={s.accounts} />
          <Stat label="예외" value={s.exempt} />
          <Stat label="한도초과" value={s.overLimit} c="#f87171" />
          <Stat label="정지예정" value={s.withPending} c="#fbbf24" />
          <Stat label="정지" value={s.withSuspended} c="#f87171" />
          <Stat label="미동기화" value={s.neverSynced} c="var(--text-tertiary)" />
        </div>
      )}

      {error && <div style={{ color: '#f87171', fontSize: 13 }}>불러오기 실패</div>}
      {isLoading && <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>불러오는 중…</div>}

      <div style={{ overflowX: 'auto', background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: 'var(--text-tertiary)', textAlign: 'left', borderBottom: '1px solid var(--border-primary)' }}>
              <th style={{ padding: '10px 12px' }}>이름</th>
              <th style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)' }}>Vantage C.T</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>수수료 잔고</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>허용</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>활성</th>
              <th style={{ padding: '10px 12px' }}>상태</th>
              <th style={{ padding: '10px 12px' }}>동기화</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isOpen = open === r.vantageCt
              return (
                <Fragment key={i}>
                  <tr onClick={() => setOpen(isOpen ? null : r.vantageCt)}
                    style={{ borderBottom: '1px solid var(--border-primary)', color: 'var(--text-secondary)', cursor: 'pointer', background: r.overLimit ? 'rgba(248,113,113,0.06)' : 'transparent' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>
                      <span style={{ color: 'var(--text-tertiary)', marginRight: 6 }}>{isOpen ? '▾' : '▸'}</span>
                      {r.name ?? '-'}
                      {r.isExempt && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent-blue)', border: '1px solid var(--accent-blue)', borderRadius: 4, padding: '1px 5px' }}>예외</span>}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)' }}>{r.vantageCt ?? '-'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{r.feeBalance != null ? `$${r.feeBalance.toLocaleString('ko-KR')}` : '-'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{r.isExempt ? '∞' : (r.allowedNodes ?? '-')}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: r.overLimit ? '#f87171' : 'var(--text-secondary)', fontWeight: r.overLimit ? 700 : 400 }}>{r.activeNodes}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {r.overLimit && <Badge t="한도초과" c="#f87171" />}
                        {r.pendingNodes > 0 && <Badge t={`정지예정 ${r.pendingNodes}`} c="#fbbf24" />}
                        {r.suspendedNodes > 0 && <Badge t={`정지 ${r.suspendedNodes}`} c="#f87171" />}
                        {!r.overLimit && r.pendingNodes === 0 && r.suspendedNodes === 0 && <Badge t="정상" c="#34d399" />}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-tertiary)' }}>{fmtDate(r.syncedAt)}</td>
                  </tr>
                  {isOpen && (
                    <tr style={{ background: 'var(--bg-inset)' }}>
                      <td colSpan={7} style={{ padding: '4px 12px 12px' }}>
                        {r.nodes.map(n => {
                          const st = STATUS[n.status] ?? { t: n.status, c: 'var(--text-tertiary)' }
                          const d = daysLeft(n.graceUntil)
                          return (
                            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-primary)', flexWrap: 'wrap' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', minWidth: 90 }}>{n.node_id}</span>
                              <Badge t={st.t} c={st.c} />
                              {n.pending === 'suspend' && <Badge t={`정지예정 D-${d ?? 0}`} c="#fbbf24" />}
                              {n.reason && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{n.reason}</span>}
                              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                                {n.pending === 'suspend' && <ActBtn label="예고취소" onClick={() => act(n.id, 'cancel_pending', `${n.node_id} 정지 예정을 취소할까요?`)} busy={busy === n.id + 'cancel_pending'} />}
                                {n.status === 'suspended' && <ActBtn label="재활성" onClick={() => act(n.id, 'reactivate', `${n.node_id} 를 재활성할까요?`)} busy={busy === n.id + 'reactivate'} />}
                                {n.status === 'expelled' && <ActBtn label="복권" onClick={() => act(n.id, 'reactivate', `${n.node_id} 제명을 해제할까요?`)} busy={busy === n.id + 'reactivate'} />}
                                {n.status === 'active' && <ActBtn label="정지" c="#f87171" onClick={() => act(n.id, 'suspend', `${n.node_id} 를 정지할까요?`)} busy={busy === n.id + 'suspend'} />}
                                {n.status !== 'expelled' && <ActBtn label="제명" c="#a78bfa" onClick={() => act(n.id, 'expel', `${n.node_id} 를 제명할까요? (수동 복권 필요)`)} busy={busy === n.id + 'expel'} />}
                              </div>
                            </div>
                          )
                        })}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>계정이 없습니다</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Stat({ label, value, c }: { label: string; value: number; c?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: c ?? 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{value}</div>
    </div>
  )
}
function Badge({ t, c }: { t: string; c: string }) {
  return <span style={{ fontSize: 11, color: c, border: `1px solid ${c}`, borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap' }}>{t}</span>
}
function ActBtn({ label, onClick, busy, c }: { label: string; onClick: () => void; busy: boolean; c?: string }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick() }} disabled={busy} style={{
      fontSize: 11, padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
      background: 'transparent', border: `1px solid ${c ?? 'var(--accent-blue)'}`, color: c ?? 'var(--accent-blue)',
      opacity: busy ? 0.5 : 1,
    }}>{label}</button>
  )
}
