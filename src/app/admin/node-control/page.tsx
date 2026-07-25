'use client'
import { useApi } from '@/lib/swr'

type Node = { node_id: string; name: string; status: string; pending: string | null; graceUntil: string | null }
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

export default function NodeControlPage() {
  const { data, isLoading, error } = useApi<Data>('/api/admin/node-control')
  const rows = data?.rows ?? []
  const s = data?.summary

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24, fontFamily: 'var(--font-main)' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>노드 통제 현황</h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
        회원 계정별 Vantage 수수료 잔고와 허용 노드 수(잔고/3,000), 현재 노드 상태. 크롤러 동기화로 갱신됩니다.
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
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border-primary)', color: 'var(--text-secondary)', background: r.overLimit ? 'rgba(248,113,113,0.06)' : 'transparent' }}>
                <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>
                  {r.name ?? '-'}
                  {r.isExempt && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent-blue)', border: '1px solid var(--accent-blue)', borderRadius: 4, padding: '1px 5px' }}>예외</span>}
                </td>
                <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)' }}>{r.vantageCt ?? '-'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                  {r.feeBalance != null ? `$${r.feeBalance.toLocaleString('ko-KR')}` : '-'}
                </td>
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
            ))}
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
