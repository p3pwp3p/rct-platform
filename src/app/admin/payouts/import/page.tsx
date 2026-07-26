'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ToastProvider'

type Breakdown = {
  vantageCt: string; name: string; pf: number; nodes: number; perNode: number[]
  status: 'ok' | 'unmatched' | 'loss_or_zero' | 'no_active_node'
}
type Summary = {
  applied: boolean; period: { from: string; to: string }
  accounts: number; matched: number; unmatched: number; lossOrZero: number; noActiveNode: number
  items: number; totalUnpaid: number
}

const STATUS_LABEL: Record<Breakdown['status'], { t: string; c: string }> = {
  ok:            { t: '분배',       c: '#34d399' },
  unmatched:     { t: '미매칭',     c: '#f87171' },
  loss_or_zero:  { t: '손실/0',     c: 'var(--text-tertiary)' },
  no_active_node:{ t: '활성노드없음', c: '#fbbf24' },
}

export default function ProfitCsvImportPage() {
  const toast = useToast()
  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState('')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [breakdown, setBreakdown] = useState<Breakdown[]>([])
  const [busy, setBusy] = useState(false)
  const [reportId, setReportId] = useState('')

  async function token() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? ''
  }

  async function onFile(f: File) {
    const text = await f.text()
    setCsv(text); setFileName(f.name); setSummary(null); setBreakdown([]); setReportId('')
  }

  async function run(apply: boolean) {
    if (!csv) { toast('CSV 파일을 선택하세요', 'error'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/import-profit-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ csv, apply }),
      })
      const json = await res.json()
      if (!res.ok) { toast(json.error ?? '오류', 'error'); return }
      setSummary(json.summary); setBreakdown(json.breakdown ?? [])
      if (apply) { setReportId(json.reportId ?? ''); toast('정산 보고서를 생성했습니다', 'success') }
      else toast('미리보기 완료', 'success')
    } finally { setBusy(false) }
  }

  const card: React.CSSProperties = {
    background: 'var(--bg-surface)', border: '1px solid var(--border-primary)',
    borderRadius: 12, padding: 20, marginBottom: 16,
  }

  return (
    <div className="pfimp-page" style={{ maxWidth: 900, margin: '0 auto', padding: 24, fontFamily: 'var(--font-main)' }}>
      <style>{`@media(max-width:768px){.pfimp-page{padding:16px 12px!important}}`}</style>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>월간 정산 임포트 (CSV)</h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
        본사 ProfitShareReview CSV → 회원별 PF(sharedProfit)를 활성 노드에 균등 분배(PF/N)해 정산 보고서를 만듭니다.
      </p>

      <div style={card}>
        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer',
          padding: '28px', border: '2px dashed var(--border-secondary)', borderRadius: 10,
          color: 'var(--text-secondary)', fontSize: 14,
        }}>
          <input type="file" accept=".csv" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
          {fileName ? `📄 ${fileName}` : '＋ CSV 파일 선택'}
        </label>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button onClick={() => run(false)} disabled={busy || !csv} style={{
            flex: 1, padding: '11px', borderRadius: 8, border: '1px solid var(--accent-blue)', cursor: 'pointer',
            background: 'transparent', color: 'var(--accent-blue)', fontWeight: 700, fontSize: 14,
            opacity: busy || !csv ? 0.5 : 1,
          }}>미리보기</button>
          <button onClick={() => run(true)} disabled={busy || !summary} style={{
            flex: 1, padding: '11px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'var(--accent-blue)', color: '#07080a', fontWeight: 700, fontSize: 14,
            opacity: busy || !summary ? 0.5 : 1,
          }}>실제 생성</button>
        </div>
      </div>

      {summary && (
        <div style={card}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
            <Stat label="기간" value={`${summary.period.from} ~ ${summary.period.to}`} />
            <Stat label="계정" value={String(summary.accounts)} />
            <Stat label="분배" value={String(summary.matched)} c="#34d399" />
            <Stat label="미매칭" value={String(summary.unmatched)} c="#f87171" />
            <Stat label="손실/0" value={String(summary.lossOrZero)} />
            <Stat label="총 분배액" value={`₩${summary.totalUnpaid.toLocaleString('ko-KR')}`} c="var(--accent-blue)" />
          </div>
          {reportId && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', fontSize: 13, marginBottom: 12 }}>
              ✅ 보고서 생성됨 (id: {reportId.slice(0, 8)}…). 이제 <b>수당 지급 관리</b>에서 payout-calc 를 실행하세요.
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--text-tertiary)', textAlign: 'left', borderBottom: '1px solid var(--border-primary)' }}>
                  <th style={{ padding: '8px 6px' }}>상태</th>
                  <th style={{ padding: '8px 6px' }}>이름</th>
                  <th style={{ padding: '8px 6px', fontFamily: 'var(--font-mono)' }}>CT</th>
                  <th style={{ padding: '8px 6px', textAlign: 'right' }}>PF</th>
                  <th style={{ padding: '8px 6px', textAlign: 'center' }}>N</th>
                  <th style={{ padding: '8px 6px' }}>노드별 분배</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((b, i) => {
                  const s = STATUS_LABEL[b.status]
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>
                      <td style={{ padding: '8px 6px' }}><span style={{ color: s.c, fontSize: 11, border: `1px solid ${s.c}`, borderRadius: 4, padding: '1px 6px' }}>{s.t}</span></td>
                      <td style={{ padding: '8px 6px', color: 'var(--text-primary)' }}>{b.name}</td>
                      <td style={{ padding: '8px 6px', fontFamily: 'var(--font-mono)' }}>{b.vantageCt}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{b.pf.toFixed(2)}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'center' }}>{b.nodes || '-'}</td>
                      <td style={{ padding: '8px 6px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{b.perNode.length ? b.perNode.map(x => x.toFixed(2)).join(' / ') : '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, c }: { label: string; value: string; c?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: c ?? 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{value}</div>
    </div>
  )
}
