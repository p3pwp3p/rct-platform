'use client'
import { useEffect, useRef, useState } from 'react'
import { useProfile } from '@/lib/contexts/ProfileContext'
import { supabase } from '@/lib/supabase'
import { useIsMobile } from '@/lib/useIsMobile'
import {
  memberSaveProfitReport,
  memberGetProfitReports,
  type MemberReportWithItems,
} from '@/lib/db'
import type { ParsedPdfReport } from '@/lib/types'

// ── 수당 수령 내역 타입 ───────────────────────────────────────────────────────
interface PayoutRow {
  id: string
  bonus_type: 'referral' | 'rank' | 'sponsor'
  amount: number
  rate: number
  generation: number
  created_at: string
  profit_reports: {
    date_from: string
    date_to: string
    status: string
  } | null
}

const BONUS_LABEL: Record<string, string> = {
  referral: '추천수당',
  rank:     '직급수당',
  sponsor:  '후원수당',
}
const BONUS_COLOR: Record<string, string> = {
  referral: '#34d399',
  rank:     '#60a5fa',
  sponsor:  '#fbbf24',
}

const STATUS_LABEL: Record<string, string> = {
  pending:   '검토중',
  confirmed: '확인됨',
  paid:      '지급완료',
  failed:    '전송실패',
}
const STATUS_COLOR: Record<string, string> = {
  pending:   '#fbbf24',
  confirmed: '#60a5fa',
  paid:      '#34d399',
  failed:    '#f87171',
}

function fmt(n: number) { return n.toFixed(2) }

function Skeleton({ w = '60%', h = 14 }: { w?: string; h?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 4,
      background: 'linear-gradient(90deg,var(--bg-inset) 25%,rgba(148,163,184,0.07) 50%,var(--bg-inset) 75%)',
      backgroundSize: '200% 100%', animation: 'sk 1.4s infinite',
    }}/>
  )
}

// ── PDF 업로드 패널 ───────────────────────────────────────────────────────────
function UploadPanel({ onParsed }: { onParsed: (r: ParsedPdfReport) => void }) {
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy]         = useState(false)
  const [err, setErr]           = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function process(file: File) {
    if (!file.name.endsWith('.pdf')) { setErr('PDF 파일만 지원합니다'); return }
    setBusy(true); setErr('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const form = new FormData()
      form.append('file', file)
      const res  = await fetch('/api/parse-pdf', { method: 'POST', body: form, headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '파싱 실패')
      onParsed(json as ParsedPdfReport)
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      onClick={() => !busy && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) process(f) }}
      style={{
        border: `2px dashed ${dragging ? '#4db6ac' : 'var(--border-secondary)'}`,
        borderRadius: 10, padding: '32px 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        cursor: busy ? 'wait' : 'pointer',
        background: dragging ? 'rgba(77,182,172,0.04)' : 'var(--bg-surface)',
        transition: 'all 0.2s',
      }}
    >
      <input ref={inputRef} type="file" accept=".pdf" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) process(f) }}/>
      {busy ? (
        <>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--border-secondary)', borderTopColor: '#4db6ac', animation: 'spin 0.8s linear infinite' }}/>
          <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)' }}>PDF 분석 중...</span>
        </>
      ) : (
        <>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4db6ac" strokeWidth="1.5" strokeLinecap="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <polyline points="9 15 12 12 15 15"/>
          </svg>
          <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
            Vantage 복사기 이익 공유 보고서 PDF를<br/>여기에 드래그하거나 클릭해서 업로드
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>.pdf</span>
        </>
      )}
      {err && <span style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: '#f87171', marginTop: 4 }}>⚠ {err}</span>}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ── 파싱 결과 미리보기 + 저장 ────────────────────────────────────────────────
function ParsePreview({
  parsed, profileId, mt5AccountId, onSave, onCancel,
}: {
  parsed: ParsedPdfReport
  profileId: string
  mt5AccountId: string
  onSave: () => void
  onCancel: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  const isMatch = parsed.mt5AccountId === mt5AccountId

  async function handleSave() {
    setSaving(true); setErr('')
    try {
      await memberSaveProfitReport(parsed, profileId, mt5AccountId)
      onSave()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'MT5 계좌 ID', value: parsed.mt5AccountId },
          { label: '기간',        value: `${parsed.dateFrom} ~ ${parsed.dateTo}` },
          { label: '총 미지급',   value: fmt(parsed.totalUnpaid) },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* 계좌 매칭 경고 */}
      {!isMatch && (
        <div style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, fontFamily: 'var(--font-main)', fontSize: 13, color: '#f87171' }}>
          ⚠ PDF의 MT5 계좌({parsed.mt5AccountId})가 내 계좌({mt5AccountId || '미등록'})와 다릅니다. 저장할 수 없습니다.
        </div>
      )}

      {/* 전략 명세 테이블 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 8, overflow: 'hidden' }}>
        <div className="tbl-scroll"><table style={{ width: '100%', minWidth: 460, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(10,12,16,0.4)', borderBottom: '1px solid var(--border-primary)' }}>
              {['전략명','기간','분배가능소득','P/F 비율','미지급 이익'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: 'var(--font-main)', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parsed.items.map((item, i) => (
              <tr key={i} style={{ borderBottom: i < parsed.items.length - 1 ? '1px solid var(--border-primary)' : 'none' }}>
                <td style={{ padding: '11px 16px', fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{item.strategyName}</td>
                <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{item.dateFrom} ~ {item.dateTo}</td>
                <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{fmt(item.distributedIncome)}</td>
                <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#fbbf24' }}>{(item.profitRatio * 100).toFixed(0)}%</td>
                <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#34d399' }}>{fmt(item.unpaidProfit)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      {err && <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: '#f87171' }}>⚠ {err}</div>}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} disabled={saving}
          style={{ padding: '9px 18px', borderRadius: 6, fontFamily: 'var(--font-main)', fontSize: 13, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border-secondary)', color: 'var(--text-secondary)' }}>
          취소
        </button>
        <button onClick={handleSave} disabled={saving || !isMatch}
          style={{ padding: '9px 18px', borderRadius: 6, fontFamily: 'var(--font-main)', fontSize: 13, cursor: (saving || !isMatch) ? 'not-allowed' : 'pointer', background: isMatch ? '#4db6ac' : 'var(--bg-inset)', border: 'none', color: isMatch ? '#000' : 'var(--text-tertiary)', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
          {saving ? '저장 중...' : '보고서 저장'}
        </button>
      </div>
    </div>
  )
}

// ── 보고서 카드 ──────────────────────────────────────────────────────────────
function ReportCard({ report }: { report: MemberReportWithItems }) {
  const [expanded, setExpanded] = useState(false)
  const sc = STATUS_COLOR[report.status]

  return (
    <div style={{ background: 'var(--bg-surface)', border: `1px solid ${expanded ? '#4db6ac44' : 'var(--border-primary)'}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.2s' }}>
      {/* 헤더 행 */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 16, alignItems: 'center', cursor: 'pointer' }}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(148,163,184,0.02)'}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = ''}
      >
        {/* 기간 */}
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{report.date_from} ~ {report.date_to}</div>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>업로드: {report.uploaded_at.slice(0, 10)}</div>
        </div>

        {/* MT5 계좌 */}
        <div>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)' }}>Vantage C.T</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#60a5fa', marginTop: 2 }}>{report.items[0]?.mt5_account_id ?? '—'}</div>
        </div>

        {/* 총액 */}
        <div>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>미지급 이익</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: '#34d399' }}>{fmt(report.total_unpaid)}</div>
        </div>

        {/* 상태 + 토글 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, fontWeight: 700, color: sc, background: sc + '18', border: `1px solid ${sc}44`, padding: '3px 10px', borderRadius: 4, whiteSpace: 'nowrap' }}>
            {STATUS_LABEL[report.status]}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      {/* 확장: 명세 */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-primary)', background: 'var(--bg-inset)' }}>
          <div className="tbl-scroll"><table style={{ width: '100%', minWidth: 460, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                {['전략명','분배가능소득','P/F 비율','미지급 이익'].map(h => (
                  <th key={h} style={{ padding: '8px 20px', textAlign: 'left', fontFamily: 'var(--font-main)', fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.items.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: i < report.items.length - 1 ? '1px solid var(--border-primary)' : 'none' }}>
                  <td style={{ padding: '10px 20px', fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-primary)' }}>{item.strategy_name}</td>
                  <td style={{ padding: '10px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{fmt(item.distributable_income)}</td>
                  <td style={{ padding: '10px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#fbbf24' }}>{(item.profit_ratio * 100).toFixed(0)}%</td>
                  <td style={{ padding: '10px 20px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#34d399' }}>{fmt(item.unpaid_profit)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  )
}

// ── 수당 수령 내역 패널 ───────────────────────────────────────────────────────
function ReceivedPayoutsPanel({ profileId }: { profileId: string }) {
  const [rows, setRows]     = useState<PayoutRow[]>([])
  const [totals, setTotals] = useState({ referral: 0, rank: 0, sponsor: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'referral' | 'rank' | 'sponsor'>('all')
  const isMobile = useIsMobile()

  useEffect(() => {
    if (!profileId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    supabase.auth.getSession().then(({ data: { session } }) => {
      const token = session?.access_token ?? ''
      return fetch(`/api/my-payouts?profileId=${profileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    })
      .then(async r => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d?.error ?? `요청 실패 (${r.status})`)
        return d
      })
      .then(d => { setRows(d.rows ?? []); setTotals(d.totals ?? { referral: 0, rank: 0, sponsor: 0, total: 0 }) })
      .catch(e => { console.error('[payouts]', e); setError('수당 수령 내역을 불러오지 못했습니다.') })
      .finally(() => setLoading(false))
  }, [profileId])

  const filtered = filter === 'all' ? rows : rows.filter(r => r.bonus_type === filter)

  const totalReferral = totals.referral
  const totalRank     = totals.rank
  const totalSponsor  = totals.sponsor

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10, overflow: 'hidden' }}>
      {/* 헤더 */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          수당 수령 내역
        </div>
        {/* 타입별 소계 */}
        <div style={{ display: 'flex', gap: 16 }}>
          {[
            { key: 'referral', label: '추천', val: totalReferral },
            { key: 'rank',     label: '직급', val: totalRank },
            { key: 'sponsor',  label: '후원', val: totalSponsor },
          ].map(({ key, label, val }) => (
            <div key={key} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: BONUS_COLOR[key] }}>
              {label} <span style={{ fontWeight: 700 }}>{fmt(val)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 필터 탭 */}
      <div style={{ padding: '8px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', gap: 6 }}>
        {(['all', 'referral', 'rank', 'sponsor'] as const).map(t => (
          <button key={t} onClick={() => setFilter(t)}
            style={{
              padding: '4px 12px', borderRadius: 4, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-main)', fontSize: 11, fontWeight: filter === t ? 700 : 400,
              background: filter === t ? (t === 'all' ? 'rgba(148,163,184,0.15)' : BONUS_COLOR[t] + '20') : 'transparent',
              color: filter === t ? (t === 'all' ? 'var(--text-primary)' : BONUS_COLOR[t]) : 'var(--text-tertiary)',
              transition: 'all 0.15s',
            }}>
            {t === 'all' ? '전체' : BONUS_LABEL[t]}
          </button>
        ))}
      </div>

      {error ? (
        <div style={{ padding: '16px 20px', margin: '16px 20px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontFamily: 'var(--font-main)', fontSize: 13, color: '#f87171' }}>⚠ {error}</div>
      ) : loading ? (
        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3].map(i => <Skeleton key={i} w="100%" h={14} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)' }}>
          수령 내역이 없습니다
        </div>
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filtered.map((row, i) => {
            const c = BONUS_COLOR[row.bonus_type]
            const period = row.profit_reports
              ? `${row.profit_reports.date_from} ~ ${row.profit_reports.date_to}`
              : row.created_at.slice(0, 10)
            return (
              <div key={row.id} style={{ padding: '13px 16px', borderTop: i === 0 ? 'none' : '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, fontWeight: 600, color: c, background: c + '18', border: `1px solid ${c}44`, padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>{BONUS_LABEL[row.bonus_type]}</span>
                    {row.generation > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{row.generation}대</span>}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#fbbf24' }}>{(row.rate * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>{period}</div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: c, whiteSpace: 'nowrap' }}>{fmt(row.amount)}</div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="tbl-scroll"><table style={{ width: '100%', minWidth: 460, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-header)' }}>
              {['기간','수당 종류','세대/압축','비율','수령액'].map(h => (
                <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontFamily: 'var(--font-main)', fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => {
              const c = BONUS_COLOR[row.bonus_type]
              const period = row.profit_reports
                ? `${row.profit_reports.date_from} ~ ${row.profit_reports.date_to}`
                : row.created_at.slice(0, 10)
              return (
                <tr key={row.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border-primary)' }}>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{period}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ fontFamily: 'var(--font-main)', fontSize: 12, fontWeight: 600, color: c, background: c + '18', border: `1px solid ${c}44`, padding: '2px 8px', borderRadius: 4 }}>
                      {BONUS_LABEL[row.bonus_type]}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {row.generation > 0 ? `${row.generation}대` : '—'}
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#fbbf24' }}>
                    {(row.rate * 100).toFixed(1)}%
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: c }}>
                    {fmt(row.amount)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table></div>
      )}
    </div>
  )
}

// ── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function MemberPayoutsPage() {
  const { activeProfile } = useProfile()
  const [reports, setReports] = useState<MemberReportWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [parsed, setParsed]   = useState<ParsedPdfReport | null>(null)

  const profileId    = activeProfile?.id ?? ''
  const mt5AccountId = activeProfile?.mt5_account_id ?? ''

  async function load() {
    if (!profileId) return
    setLoading(true)
    setError(null)
    try { setReports(await memberGetProfitReports(profileId)) }
    catch (e: any) { console.error(e); setError('수당 보고서를 불러오지 못했습니다.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [profileId])

  const totalPending   = reports.filter(r => r.status === 'pending').reduce((s, r) => s + r.total_unpaid, 0)
  const totalConfirmed = reports.filter(r => r.status === 'confirmed').reduce((s, r) => s + r.total_unpaid, 0)
  const totalPaid      = reports.filter(r => r.status === 'paid').reduce((s, r) => s + r.total_unpaid, 0)
  const totalFailed    = reports.filter(r => r.status === 'failed').reduce((s, r) => s + r.total_unpaid, 0)

  return (
    <>
      <style>{`
        @keyframes sk { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes spin { to { transform: rotate(360deg) } }
        .tbl-scroll { overflow-x: auto; }
        @media (max-width: 768px) {
          .pay-wrap { padding: 16px !important; }
          .pay-kpi { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
      <div style={{ flex: 1, overflowY: 'auto' }}>
      <div className="pay-wrap" style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 860, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        {/* 헤더 */}
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, fontFamily: 'var(--font-main)' }}>수당 내역</h1>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-main)' }}>
            Vantage 복사기 이익 공유 보고서를 업로드하면 수당 내역이 자동으로 등록됩니다.
          </p>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontFamily: 'var(--font-main)', fontSize: 13, color: '#f87171' }}>⚠ {error}</div>
        )}

        {/* MT5 계좌 미등록 경고 */}
        {!mt5AccountId && (
          <div style={{ padding: '12px 16px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 8, fontFamily: 'var(--font-main)', fontSize: 13, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            이 노드에 Vantage C.T 계정 번호가 등록되지 않았습니다. 내 프로필에서 등록하거나 관리자에게 문의해주세요.
          </div>
        )}

        {/* KPI 요약 */}
        <div className="pay-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: '검토중',   value: totalPending,   color: '#fbbf24' },
            { label: '확인됨',   value: totalConfirmed, color: '#60a5fa' },
            { label: '지급완료', value: totalPaid,      color: '#34d399' },
            { label: '전송실패', value: totalFailed,    color: '#f87171' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: 2, background: color, flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)' }}>{label}</span>
              </div>
              {loading
                ? <Skeleton w="80%" h={24} />
                : <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color }}>{fmt(value)}</div>
              }
            </div>
          ))}
        </div>

        {/* PDF 업로드 or 미리보기 */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10, padding: 20 }}>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
            PDF 업로드
          </div>
          {parsed ? (
            <ParsePreview
              parsed={parsed}
              profileId={profileId}
              mt5AccountId={mt5AccountId}
              onSave={() => { setParsed(null); load() }}
              onCancel={() => setParsed(null)}
            />
          ) : (
            <UploadPanel onParsed={setParsed} />
          )}
        </div>

        {/* 보고서 목록 */}
        <div>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
            보고서 내역 ({reports.length}건)
          </div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2].map(i => (
                <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10, padding: '16px 20px', display: 'flex', gap: 16 }}>
                  <Skeleton w="20%" h={16} /><Skeleton w="15%" h={16} /><Skeleton w="12%" h={16} />
                </div>
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)' }}>
              업로드된 보고서가 없습니다
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reports.map(r => <ReportCard key={r.id} report={r} />)}
            </div>
          )}
        </div>

          {/* 수당 수령 내역 */}
        <ReceivedPayoutsPanel profileId={profileId} />

      </div>
      </div>
    </>
  )
}
