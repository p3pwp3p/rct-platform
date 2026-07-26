'use client'
import { Fragment, useState } from 'react'
import { useApi } from '@/lib/swr'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ToastProvider'

type Node = { id: string; node_id: string; name: string; status: string; pending: string | null; graceUntil: string | null; reason: string | null }
type Row = {
  vantageCt: string | null; name: string | null; feeBalance: number | null
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
  const [open, setOpen] = useState<number | null>(null)
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

  const th: React.CSSProperties = {
    padding: '12px 16px', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
    textTransform: 'uppercase', color: 'var(--text-tertiary)', whiteSpace: 'nowrap',
  }

  return (
    <div className="nc-page" style={{ maxWidth: 1280, margin: '0 auto', padding: 24, fontFamily: 'var(--font-main)' }}>
      <style>{`.nc-row:hover{background:var(--bg-inset)!important}@media(max-width:768px){.nc-page{padding:16px 12px!important}}`}</style>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>노드 통제 현황</h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
        회원 계정별 Vantage 수수료 잔고와 허용 노드 수(잔고 ÷ 3,000), 노드 상태. 행을 클릭하면 노드별 상세·조치.
      </p>

      {s && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 22 }}>
          <StatCard label="계정" value={s.accounts} />
          <StatCard label="예외" value={s.exempt} c="var(--accent-blue)" />
          <StatCard label="한도초과" value={s.overLimit} c="#f87171" />
          <StatCard label="정지예정" value={s.withPending} c="#fbbf24" />
          <StatCard label="정지" value={s.withSuspended} c="#f87171" />
          <StatCard label="미동기화" value={s.neverSynced} c="var(--text-tertiary)" />
        </div>
      )}

      {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>불러오기 실패</div>}
      {isLoading && <div style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 12 }}>불러오는 중…</div>}

      <div style={{ overflowX: 'auto', background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 14 }}>
        <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-header)' }}>
              <th style={{ ...th, textAlign: 'left', width: '26%' }}>이름</th>
              <th style={{ ...th, textAlign: 'left' }}>Vantage C.T</th>
              <th style={{ ...th, textAlign: 'right' }}>수수료 잔고</th>
              <th style={{ ...th, textAlign: 'center' }}>허용</th>
              <th style={{ ...th, textAlign: 'center' }}>활성</th>
              <th style={{ ...th, textAlign: 'left' }}>상태</th>
              <th style={{ ...th, textAlign: 'left' }}>동기화</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isOpen = open === i
              return (
                <Fragment key={i}>
                  <tr className="nc-row" onClick={() => setOpen(isOpen ? null : i)}
                    style={{
                      borderBottom: isOpen ? 'none' : '1px solid var(--border-primary)',
                      color: 'var(--text-secondary)', cursor: 'pointer',
                      background: r.overLimit ? 'rgba(248,113,113,0.06)' : (isOpen ? 'var(--bg-inset)' : 'transparent'),
                      transition: 'background 0.12s',
                    }}>
                    <td style={{ padding: '13px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>
                      <span style={{ color: 'var(--text-tertiary)', marginRight: 8, display: 'inline-block', width: 10, transition: 'transform 0.15s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>▸</span>
                      {r.name ?? '—'}
                      {r.isExempt && <Badge t="예외" c="var(--accent-blue)" ml />}
                    </td>
                    <td style={{ padding: '13px 16px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{r.vantageCt ?? '—'}</td>
                    <td style={{ padding: '13px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: r.feeBalance != null ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                      {r.feeBalance != null ? `$${r.feeBalance.toLocaleString('ko-KR')}` : '—'}
                    </td>
                    <td style={{ padding: '13px 16px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{r.isExempt ? '∞' : (r.allowedNodes ?? '—')}</td>
                    <td style={{ padding: '13px 16px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: r.overLimit ? '#f87171' : 'var(--text-primary)', fontWeight: r.overLimit ? 700 : 500 }}>{r.activeNodes}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {r.overLimit && <Badge t="한도초과" c="#f87171" />}
                        {r.pendingNodes > 0 && <Badge t={`정지예정 ${r.pendingNodes}`} c="#fbbf24" />}
                        {r.suspendedNodes > 0 && <Badge t={`정지 ${r.suspendedNodes}`} c="#f87171" />}
                        {!r.overLimit && r.pendingNodes === 0 && r.suspendedNodes === 0 && <Badge t="정상" c="#34d399" />}
                      </div>
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{fmtDate(r.syncedAt)}</td>
                  </tr>
                  {isOpen && (
                    <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                      <td colSpan={7} style={{ padding: '2px 16px 14px', background: 'var(--bg-inset)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {r.nodes.map(n => {
                            const st = STATUS[n.status] ?? { t: n.status, c: 'var(--text-tertiary)' }
                            const d = daysLeft(n.graceUntil)
                            return (
                              <div key={n.id} style={{
                                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', flexWrap: 'wrap',
                                background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10,
                              }}>
                                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600, minWidth: 96 }}>{n.node_id}</span>
                                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{n.name}</span>
                                <Badge t={st.t} c={st.c} />
                                {n.pending === 'suspend' && <Badge t={`정지예정 D-${d ?? 0}`} c="#fbbf24" />}
                                {n.reason && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>· {n.reason}</span>}
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
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>계정이 없습니다</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({ label, value, c }: { label: string; value: number; c?: string }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6, letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: c ?? 'var(--text-primary)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value}</div>
    </div>
  )
}
function Badge({ t, c, ml }: { t: string; c: string; ml?: boolean }) {
  const bg = c.startsWith('#') ? `${c}14` : 'transparent'
  return <span style={{ marginLeft: ml ? 6 : 0, fontSize: 11, color: c, border: `1px solid ${c}`, background: bg, borderRadius: 5, padding: '2px 7px', whiteSpace: 'nowrap', fontWeight: 500 }}>{t}</span>
}
function ActBtn({ label, onClick, busy, c }: { label: string; onClick: () => void; busy: boolean; c?: string }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick() }} disabled={busy} style={{
      fontSize: 11.5, padding: '4px 11px', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
      background: 'transparent', border: `1px solid ${c ?? 'var(--accent-blue)'}`, color: c ?? 'var(--accent-blue)',
      opacity: busy ? 0.5 : 1, transition: 'opacity 0.12s',
    }}>{label}</button>
  )
}
