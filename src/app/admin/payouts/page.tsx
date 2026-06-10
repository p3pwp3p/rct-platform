'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  adminGetProfitReports,
  adminSaveProfitReport,
  adminUpdateReportStatus,
  adminDeleteReport,
  adminSaveCsvExportLog,
  adminGetCsvExportLogs,
  adminApplyBinanceResult,
  adminGetMissingMembers,
  type ProfitReportWithItems,
  type MissingMember,
} from '@/lib/db-admin'
import type { CsvExportLog, ParsedPdfReport } from '@/lib/types'
import type { BinanceResultRow } from '@/app/api/parse-binance-result/route'

const STATUS_LABEL: Record<string, string> = {
  pending:   '미확인',
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

// ── Binance 결과 모달 ─────────────────────────────────────────────────────────
function BinanceResultModal({ result, onClose }: {
  result: { paidCount: number; failedCount: number }
  onClose: () => void
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 14, padding: '32px 36px', minWidth: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, boxShadow: '0 24px 80px rgba(0,0,0,0.6)', animation: 'fadeUp 0.25s cubic-bezier(0.16,1,0.3,1)' }}>

        {/* 아이콘 */}
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>

        {/* 타이틀 */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>전송 결과 반영 완료</div>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)' }}>보고서 상태가 업데이트됐습니다</div>
        </div>

        {/* 결과 수치 */}
        <div style={{ display: 'flex', gap: 16, width: '100%' }}>
          <div style={{ flex: 1, background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 10, padding: '14px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, color: '#34d399', lineHeight: 1 }}>{result.paidCount}</span>
            <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: '#34d399' }}>지급완료</span>
          </div>
          <div style={{ flex: 1, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '14px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, color: '#f87171', lineHeight: 1 }}>{result.failedCount}</span>
            <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: '#f87171' }}>전송실패</span>
          </div>
        </div>

        {result.failedCount > 0 && (
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.6 }}>
            실패한 건은 <span style={{ color: '#f87171' }}>전송실패</span> 상태로 보고서 이력에서 확인하세요
          </div>
        )}

        <button
          onClick={onClose}
          style={{ width: '100%', padding: '11px', borderRadius: 8, fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#34d399', border: 'none', color: '#000', transition: 'opacity 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
          확인
        </button>
      </div>
    </div>
  )
}

// ── 커스텀 DatePicker ─────────────────────────────────────────────────────────
const WEEKDAYS = ['일','월','화','수','목','금','토']
const MONTHS   = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

function DatePicker({ value, onChange, placeholder = '날짜 선택', accentColor = '#fbbf24' }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  accentColor?: string
}) {
  const [open, setOpen] = useState(false)
  const ref             = useRef<HTMLDivElement>(null)
  const btnRef          = useRef<HTMLButtonElement>(null)
  const [pos, setPos]   = useState({ top: 0, left: 0 })
  const today           = new Date()
  const parsed          = value ? new Date(value + 'T00:00:00') : null
  const [viewYear, setViewYear]   = useState(parsed?.getFullYear() ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth()    ?? today.getMonth())

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  function openPicker() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, left: r.left })
    }
    setOpen(o => !o)
  }

  const firstDay  = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMon = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMon }, (_, i) => i + 1),
  ]

  const todayStr   = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
  const displayVal = parsed
    ? `${parsed.getFullYear()}.${String(parsed.getMonth()+1).padStart(2,'0')}.${String(parsed.getDate()).padStart(2,'0')}`
    : ''

  function prevMonth() { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1) } else setViewMonth(m => m-1) }
  function nextMonth() { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1) } else setViewMonth(m => m+1) }
  function selectDay(d: number) {
    onChange(`${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`)
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ display: 'inline-block' }}>
      <button
        ref={btnRef}
        onClick={openPicker}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', borderRadius: 6, cursor: 'pointer',
          background: 'var(--bg-inset)',
          border: `1px solid ${open ? accentColor : 'var(--border-secondary)'}`,
          color: displayVal ? 'var(--text-primary)' : 'var(--text-tertiary)',
          fontFamily: 'var(--font-main)', fontSize: 13,
          transition: 'border-color 0.15s', whiteSpace: 'nowrap',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        {displayVal || placeholder}
      </button>

      {/* fixed 팝오버 — overflow 클리핑 없음 */}
      {open && (
        <div style={{
          position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999,
          background: 'var(--bg-surface)', border: '1px solid var(--border-primary)',
          borderRadius: 10, padding: '14px', width: 236,
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
          animation: 'calPop 0.15s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <style>{`@keyframes calPop { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:translateY(0) } }`}</style>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button onClick={prevMonth} style={{ width: 24, height: 24, border: 'none', background: 'var(--bg-inset)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {viewYear}년 {MONTHS[viewMonth]}
            </span>
            <button onClick={nextMonth} style={{ width: 24, height: 24, border: 'none', background: 'var(--bg-inset)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
            {WEEKDAYS.map((d, i) => (
              <div key={d} style={{ textAlign: 'center', fontFamily: 'var(--font-main)', fontSize: 10, fontWeight: 600, color: i === 0 ? '#f87171' : i === 6 ? '#60a5fa' : 'var(--text-tertiary)', padding: '2px 0' }}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {cells.map((day, idx) => {
              if (!day) return <div key={idx}/>
              const iso = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const isToday = iso === todayStr
              const isSel   = iso === value
              const dow     = idx % 7
              return (
                <button key={idx} onClick={() => selectDay(day)}
                  style={{
                    width: '100%', aspectRatio: '1', border: 'none', borderRadius: 5, cursor: 'pointer',
                    background: isSel ? accentColor : isToday ? accentColor + '22' : 'transparent',
                    color: isSel ? '#000' : isToday ? accentColor : dow === 0 ? '#f87171' : dow === 6 ? '#60a5fa' : 'var(--text-primary)',
                    fontFamily: 'var(--font-main)', fontSize: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-inset)' }}
                  onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLButtonElement).style.background = isToday ? accentColor + '22' : 'transparent' }}
                >
                  {day}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => { onChange(todayStr); setOpen(false); setViewYear(today.getFullYear()); setViewMonth(today.getMonth()) }}
            style={{ marginTop: 10, width: '100%', padding: '6px', border: `1px solid ${accentColor}44`, borderRadius: 5, background: 'transparent', color: accentColor, fontFamily: 'var(--font-main)', fontSize: 11, cursor: 'pointer' }}
          >
            오늘
          </button>
        </div>
      )}
    </div>
  )
}

function Skeleton({ w = '60%', h = 14 }: { w?: string; h?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 4,
      background: 'linear-gradient(90deg,var(--bg-inset) 25%,rgba(148,163,184,0.07) 50%,var(--bg-inset) 75%)',
      backgroundSize: '200% 100%', animation: 'sk 1.4s infinite',
    }}/>
  )
}

// ── PDF 업로드 패널 ──────────────────────────────────────────────────────────
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
      setErr(e?.message ?? '오류')
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
      <input ref={inputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) process(f) }}/>
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
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>.pdf 파일만 지원</span>
        </>
      )}
      {err && <span style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: '#f87171', marginTop: 4 }}>⚠ {err}</span>}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ── 파싱 결과 미리보기 + 저장 ────────────────────────────────────────────────
function ParsePreview({ parsed, onSave, onCancel }: {
  parsed: ParsedPdfReport
  onSave: () => void
  onCancel: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  async function handleSave() {
    setSaving(true); setErr('')
    try {
      await adminSaveProfitReport(parsed)
      onSave()
    } catch (e: any) {
      setErr(e?.message ?? '오류')
    } finally {
      setSaving(false)
    }
  }

  const matched = parsed.items.some((_, i, a) => i === 0) // just check first for now
  // Actually we don't know the match status here — it's determined server-side
  // Just show the raw data nicely

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 요약 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'MT5 계좌 ID', value: parsed.mt5AccountId },
          { label: '기간', value: `${parsed.dateFrom} ~ ${parsed.dateTo}` },
          { label: '총 미지급 이익', value: `$${fmt(parsed.totalUnpaid)}` },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* 전략 명세 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(10,12,16,0.4)', borderBottom: '1px solid var(--border-primary)' }}>
              {['전략명','기간','분배가능소득','분윤','미지급 이익'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: 'var(--font-main)', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parsed.items.map((item, i) => (
              <tr key={i} style={{ borderBottom: i < parsed.items.length - 1 ? '1px solid var(--border-primary)' : 'none' }}>
                <td style={{ padding: '11px 16px', fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{item.strategyName}</td>
                <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{item.dateFrom} ~ {item.dateTo}</td>
                <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>${fmt(item.distributedIncome)}</td>
                <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#fbbf24' }}>{(item.profitRatio * 100).toFixed(0)}%</td>
                <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#34d399' }}>${fmt(item.unpaidProfit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {err && <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: '#f87171' }}>⚠ {err}</div>}

      {/* 버튼 */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} disabled={saving}
          style={{ padding: '9px 18px', borderRadius: 6, fontFamily: 'var(--font-main)', fontSize: 13, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border-secondary)', color: 'var(--text-secondary)' }}>
          취소
        </button>
        <button onClick={handleSave} disabled={saving}
          style={{ padding: '9px 18px', borderRadius: 6, fontFamily: 'var(--font-main)', fontSize: 13, cursor: saving ? 'wait' : 'pointer', background: '#4db6ac', border: 'none', color: '#000', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
          {saving ? '저장 중...' : '보고서 저장'}
        </button>
      </div>
    </div>
  )
}

// ── 수당 계산 결과 패널 ──────────────────────────────────────────────────────
function PayoutCalcPanel({ reportId, onClose }: { reportId: string; onClose: () => void }) {
  type RecipRow     = { profileId: string; nodeId: string; name: string; nodeRank: string; referral: number; rank_bonus: number; sponsor: number; total: number }
  type Preview      = { earnerCount: number; totalBase: number; totalReferral: number; totalRank: number; totalSponsor: number; totalForfeited: number; forfeitedCount: number; totalDistributed: number; rowCount: number; recipientCount: number; recipientSummary: RecipRow[] }
  type SavedRow     = { nodeId: string; name: string; rank: string; referral: number; rank_bonus: number; sponsor: number; total: number }
  type ForfeitedRow = { id: string; profile_id: string; node_id: string; name: string; rank: string; status: string; amount: number; reason: 'suspended' | 'expelled' }

  const [step, setStep]               = useState<'idle' | 'previewing' | 'saving' | 'done' | 'loading_saved'>('idle')
  const [preview, setPreview]         = useState<Preview | null>(null)
  const [saved, setSaved]             = useState<SavedRow[] | null>(null)
  const [err, setErr]                 = useState('')
  const [errType, setErrType]         = useState<'warn' | 'block'>('warn')
  const [forfeited, setForfeited]     = useState<ForfeitedRow[] | null>(null)
  const [forfeitOpen, setForfeitOpen] = useState(false)

  async function getToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? ''
  }

  async function doPreview() {
    setStep('previewing'); setErr('')
    try {
      const token = await getToken()
      const res  = await fetch('/api/payout-calc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reportId, preview: true }),
      })
      const json = await res.json()
      if (res.status === 409) { setErrType('block'); throw new Error(json.error) }
      if (!res.ok) throw new Error(json.error)
      setPreview(json as Preview)
      setStep('idle')
    } catch (e: any) { setErr(e?.message ?? '오류'); setStep('idle') }
  }

  async function doSave() {
    if (!confirm('수당 분배 결과를 DB에 저장할까요?')) return
    setStep('saving'); setErr('')
    try {
      const token = await getToken()
      const res  = await fetch('/api/payout-calc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reportId, preview: false }),
      })
      const json = await res.json()
      if (res.status === 409) { setErrType('block'); throw new Error(json.error) }
      if (!res.ok) throw new Error(json.error)
      setStep('done')
      await loadForfeited()
    } catch (e: any) { setErr(e?.message ?? '오류'); setStep('idle') }
  }

  async function loadSaved() {
    setStep('loading_saved'); setErr('')
    try {
      const token = await getToken()
      const res  = await fetch(`/api/payout-calc?reportId=${reportId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSaved(json.recipients as SavedRow[])
      setStep('idle')
      await loadForfeited()
    } catch (e: any) { setErr(e?.message ?? '오류'); setStep('idle') }
  }

  async function loadForfeited() {
    try {
      const token = await getToken()
      const res  = await fetch(`/api/admin/forfeited?reportId=${reportId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (res.ok) setForfeited(json.rows as ForfeitedRow[])
    } catch { /* 낙전 없어도 무시 */ }
  }

  async function downloadCsv() {
    const token = await getToken()
    // Authorization 헤더가 필요한 GET → window.open 불가, fetch 후 Blob 다운로드
    const res = await fetch(`/api/payout-export?reportId=${reportId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) { alert('CSV 내보내기 실패'); return }
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `payout_${reportId.slice(0, 8)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const busy = step === 'previewing' || step === 'saving' || step === 'loading_saved'
  const fmt2 = (n: number) => n.toFixed(2)

  return (
    <div style={{ borderTop: '1px solid var(--border-primary)', padding: '16px 20px', background: 'var(--bg-inset)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>수당 계산</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={doPreview} disabled={busy} style={{ padding: '5px 12px', borderRadius: 5, fontFamily: 'var(--font-main)', fontSize: 12, cursor: busy ? 'wait' : 'pointer', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', opacity: busy ? 0.5 : 1 }}>
            {step === 'previewing' ? '계산 중...' : '미리보기'}
          </button>
          {preview && (
            <button onClick={doSave} disabled={busy || step === 'done'} style={{ padding: '5px 12px', borderRadius: 5, fontFamily: 'var(--font-main)', fontSize: 12, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', background: step === 'done' ? 'rgba(52,211,153,0.15)' : '#4db6ac', border: 'none', color: step === 'done' ? '#34d399' : '#000', opacity: busy ? 0.5 : 1 }}>
              {step === 'saving' ? '저장 중...' : step === 'done' ? '✓ 저장됨' : 'DB 저장'}
            </button>
          )}
          <button onClick={loadSaved} disabled={busy} style={{ padding: '5px 12px', borderRadius: 5, fontFamily: 'var(--font-main)', fontSize: 12, cursor: busy ? 'wait' : 'pointer', background: 'transparent', border: '1px solid var(--border-secondary)', color: 'var(--text-tertiary)', opacity: busy ? 0.5 : 1 }}>
            {step === 'loading_saved' ? '조회 중...' : '저장 결과 조회'}
          </button>
          {/* CSV 내보내기 — 저장 완료 후 활성화 */}
          {(step === 'done' || saved) && (
            <button onClick={downloadCsv} style={{ padding: '5px 12px', borderRadius: 5, fontFamily: 'var(--font-main)', fontSize: 12, cursor: 'pointer', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399' }}>
              CSV
            </button>
          )}
          <button onClick={onClose} style={{ padding: '5px 8px', borderRadius: 5, background: 'transparent', border: '1px solid var(--border-secondary)', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 12 }}>✕</button>
        </div>
      </div>

      {err && (
        <div style={{
          fontFamily: 'var(--font-main)', fontSize: 12,
          color:      errType === 'block' ? '#f87171' : '#fbbf24',
          background: errType === 'block' ? 'rgba(239,68,68,0.08)' : 'rgba(251,191,36,0.08)',
          border:     `1px solid ${errType === 'block' ? 'rgba(239,68,68,0.2)' : 'rgba(251,191,36,0.2)'}`,
          borderRadius: 6, padding: '8px 12px',
        }}>
          {errType === 'block' ? '🔒 ' : '⚠ '}{err}
        </div>
      )}

      {/* 미리보기 요약 */}
      {preview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {[
              { label: '분윤 총합',       value: `$${fmt2(preview.totalBase)}`,       color: 'var(--text-primary)' },
              { label: '추천 수당 (20%)', value: `$${fmt2(preview.totalReferral)}`,   color: '#fbbf24' },
              { label: '직급 수당 (20%)', value: `$${fmt2(preview.totalRank)}`,       color: '#60a5fa' },
              { label: '후원 수당 (40%)', value: `$${fmt2(preview.totalSponsor)}`,    color: '#c084fc' },
              { label: `낙전 (${preview.forfeitedCount}건)`, value: `$${fmt2(preview.totalForfeited ?? 0)}`, color: '#f87171' },
            ].map(card => (
              <div key={card.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 7, padding: '10px 14px' }}>
                <div style={{ fontFamily: 'var(--font-main)', fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4 }}>{card.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: card.color }}>{card.value}</div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)' }}>
            수령인 {preview.recipientCount}명 · 분배 {preview.rowCount}건 · 총 분배액 <span style={{ color: '#34d399', fontFamily: 'var(--font-mono)' }}>${fmt2(preview.totalDistributed)}</span>
          </div>
          {/* 낙전 내역 — DB 저장 후 표시 */}
          {forfeited !== null && forfeited.length > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, overflow: 'hidden' }}>
              <button
                onClick={() => setForfeitOpen(o => !o)}
                style={{ width: '100%', padding: '8px 14px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, fontWeight: 600, color: '#f87171' }}>
                  🚫 낙전 수당 내역 ({forfeited.length}건 · ${fmt2(forfeited.reduce((s,r) => s+r.amount, 0))})
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" style={{ transition: 'transform 0.2s', transform: forfeitOpen ? 'rotate(180deg)' : 'none' }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {forfeitOpen && (
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '12%' }}/><col style={{ width: '22%' }}/><col style={{ width: '8%' }}/><col style={{ width: '40%' }}/><col style={{ width: '18%' }}/>
                  </colgroup>
                  <thead>
                    <tr style={{ background: 'rgba(239,68,68,0.06)', borderBottom: '1px solid rgba(239,68,68,0.15)' }}>
                      {['노드 ID','이름','직급','사유','낙전액'].map(h => (
                        <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontFamily: 'var(--font-main)', fontSize: 10, color: '#f87171', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {forfeited.map((r, i) => (
                      <tr key={r.id} style={{ borderBottom: i < forfeited.length - 1 ? '1px solid rgba(239,68,68,0.1)' : 'none' }}>
                        <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#60a5fa' }}>{r.node_id}</td>
                        <td style={{ padding: '7px 12px', fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</td>
                        <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>{r.rank}</td>
                        <td style={{ padding: '7px 12px' }}>
                          <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: r.reason === 'expelled' ? '#f87171' : '#fbbf24', background: r.reason === 'expelled' ? 'rgba(239,68,68,0.08)' : 'rgba(251,191,36,0.08)', border: `1px solid ${r.reason === 'expelled' ? 'rgba(239,68,68,0.2)' : 'rgba(251,191,36,0.2)'}`, borderRadius: 4, padding: '1px 7px' }}>
                            {r.reason === 'expelled' ? '제명' : '정지'}
                          </span>
                        </td>
                        <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#f87171', textAlign: 'right' }}>${fmt2(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {/* 수령인 목록 */}
          {preview.recipientSummary.length > 0 && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 8, overflow: 'hidden', maxHeight: 220, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '6%' }} /><col style={{ width: '20%' }} /><col style={{ width: '18%' }} /><col style={{ width: '18%' }} /><col style={{ width: '18%' }} /><col style={{ width: '20%' }} />
                </colgroup>
                <thead>
                  <tr style={{ background: 'rgba(10,12,16,0.4)', borderBottom: '1px solid var(--border-primary)', position: 'sticky', top: 0 }}>
                    {['직급', '이름', '추천 수당', '직급 수당', '후원 수당', '합계'].map(h => (
                      <th key={h} style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'var(--font-main)', fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.recipientSummary.slice(0, 50).map((r, i) => (
                    <tr key={r.profileId + i} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                      <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#60a5fa', textAlign: 'right' }}>{r.nodeRank}</td>
                      <td style={{ padding: '7px 12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-primary)' }}>{r.name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 5 }}>{r.nodeId}</span>
                      </td>
                      <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#fbbf24', textAlign: 'right' }}>${fmt2(r.referral)}</td>
                      <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#60a5fa', textAlign: 'right' }}>${fmt2(r.rank_bonus)}</td>
                      <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#c084fc', textAlign: 'right' }}>${fmt2(r.sponsor)}</td>
                      <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#34d399', textAlign: 'right' }}>${fmt2(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 저장된 결과 */}
      {saved && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8, overflow: 'hidden', maxHeight: 220, overflowY: 'auto' }}>
          <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border-primary)', fontFamily: 'var(--font-main)', fontSize: 11, color: '#34d399', fontWeight: 600 }}>저장된 분배 결과</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '6%' }} /><col style={{ width: '20%' }} /><col style={{ width: '18%' }} /><col style={{ width: '18%' }} /><col style={{ width: '18%' }} /><col style={{ width: '20%' }} />
            </colgroup>
            <tbody>
              {saved.map((r, i) => (
                <tr key={r.nodeId + i} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                  <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#60a5fa', textAlign: 'right' }}>{r.rank}</td>
                  <td style={{ padding: '7px 12px', fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</td>
                  <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#fbbf24', textAlign: 'right' }}>${fmt2(r.referral)}</td>
                  <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#60a5fa', textAlign: 'right' }}>${fmt2(r.rank_bonus)}</td>
                  <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#c084fc', textAlign: 'right' }}>${fmt2(r.sponsor)}</td>
                  <td style={{ padding: '7px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#34d399', textAlign: 'right' }}>${fmt2(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── 보고서 카드 ──────────────────────────────────────────────────────────────
function ReportCard({ report, onRefresh }: { report: ProfitReportWithItems; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy]         = useState(false)
  const [showCalc, setShowCalc] = useState(false)

  const sc  = STATUS_COLOR[report.status]
  const hasMatch = report.items.some(i => i.matched_node_id)

  async function advance() {
    if (busy) return
    setBusy(true)
    try {
      // pending→confirmed, confirmed→paid, failed→confirmed(재시도)
      const next: 'confirmed' | 'paid' =
        report.status === 'pending'  ? 'confirmed' :
        report.status === 'failed'   ? 'confirmed' :
        'paid'
      await adminUpdateReportStatus(report.id, next)
      onRefresh()
    } catch (e: any) { alert(e?.message ?? '오류') } finally { setBusy(false) }
  }

  async function markFailed() {
    if (!confirm('이 보고서를 전송실패로 표시할까요?')) return
    setBusy(true)
    try {
      await adminUpdateReportStatus(report.id, 'failed')
      onRefresh()
    } catch (e: any) { alert(e?.message ?? '오류') } finally { setBusy(false) }
  }

  async function del() {
    if (!confirm('이 보고서를 삭제할까요?')) return
    setBusy(true)
    try { await adminDeleteReport(report.id); onRefresh() }
    catch (e: any) { alert(e?.message ?? '오류') } finally { setBusy(false) }
  }

  return (
    <div style={{ background: 'var(--bg-surface)', border: `1px solid ${expanded ? '#4db6ac44' : 'var(--border-primary)'}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.2s' }}>
      {/* 헤더 행 */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: '210px 150px minmax(0,1fr) 130px 360px', gap: 16, alignItems: 'center', cursor: 'pointer' }}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(148,163,184,0.02)'}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = ''}
      >
        {/* 기간 */}
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{report.date_from} ~ {report.date_to}</div>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>업로드: {report.uploaded_at.slice(0,10)}</div>
        </div>

        {/* MT5 계좌 */}
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>MT5 계좌</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#60a5fa', marginTop: 2 }}>{report.items[0]?.mt5_account_id ?? '—'}</div>
        </div>

        {/* 매칭 노드 */}
        <div>
          {hasMatch ? (
            <>
              <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)' }}>매칭 노드</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#4db6ac' }}>{report.items[0]?.matched_node_id}</span>
                <span style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-secondary)' }}>{report.items[0]?.matched_name}</span>
              </div>
            </>
          ) : (
            <span style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '2px 8px', borderRadius: 4 }}>
              ⚠ 노드 미매칭
            </span>
          )}
        </div>

        {/* 총액 + 상태 */}
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: '#34d399' }}>${fmt(report.total_unpaid)}</div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: sc, background: sc + '18', border: `1px solid ${sc}44`, padding: '1px 7px', borderRadius: 4, marginTop: 4, display: 'inline-block' }}>
            {STATUS_LABEL[report.status]}
          </span>
        </div>

        {/* 액션 버튼 */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {/* 앞으로 진행: pending→confirmed, confirmed→paid */}
          {(report.status === 'pending' || report.status === 'confirmed') && (
            <button onClick={e => { e.stopPropagation(); advance() }} disabled={busy}
              style={{ padding: '6px 12px', borderRadius: 5, fontFamily: 'var(--font-main)', fontSize: 12, cursor: 'pointer', background: report.status === 'pending' ? '#fbbf2420' : '#34d39920', border: `1px solid ${report.status === 'pending' ? '#fbbf24' : '#34d399'}55`, color: report.status === 'pending' ? '#fbbf24' : '#34d399', fontWeight: 600 }}>
              {report.status === 'pending' ? '확인' : '지급완료'}
            </button>
          )}
          {/* 전송실패 수동 처리 — confirmed 상태에서만 (confirmed=계산완료 상태에서 실패 가능) */}
          {report.status === 'confirmed' && (
            <button onClick={e => { e.stopPropagation(); markFailed() }} disabled={busy}
              style={{ padding: '6px 10px', borderRadius: 5, fontFamily: 'var(--font-main)', fontSize: 12, cursor: 'pointer', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontWeight: 600 }}>
              전송실패
            </button>
          )}
          {/* failed → confirmed 로 복구 */}
          {report.status === 'failed' && (
            <button onClick={e => { e.stopPropagation(); advance() }} disabled={busy}
              style={{ padding: '6px 12px', borderRadius: 5, fontFamily: 'var(--font-main)', fontSize: 12, cursor: 'pointer', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', fontWeight: 600 }}>
              재시도
            </button>
          )}
          {/* 수당 계산 버튼 — 매칭된 보고서 + paid 아닌 경우 */}
          {report.items.some(i => i.matched_profile_id) && report.status !== 'paid' && (
            <button
              onClick={e => { e.stopPropagation(); setShowCalc(v => !v) }}
              style={{ padding: '6px 12px', borderRadius: 5, fontFamily: 'var(--font-main)', fontSize: 12, cursor: 'pointer', background: showCalc ? 'rgba(192,132,252,0.15)' : 'rgba(192,132,252,0.08)', border: `1px solid rgba(192,132,252,${showCalc ? '0.5' : '0.2'})`, color: '#c084fc', fontWeight: 600, transition: 'all 0.15s' }}>
              수당 계산
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); del() }} disabled={busy}
            style={{ padding: '6px 10px', borderRadius: 5, fontFamily: 'var(--font-main)', fontSize: 12, cursor: 'pointer', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
            삭제
          </button>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" style={{ transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none', alignSelf: 'center' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      {/* 수당 계산 패널 */}
      {showCalc && <PayoutCalcPanel reportId={report.id} onClose={() => setShowCalc(false)} />}

      {/* 확장: 명세 */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-primary)', background: 'var(--bg-inset)' }}>
          {/* TRC-20 지갑 */}
          {report.items[0]?.trc20_address && (
            <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)' }}>지급 지갑 (TRC-20)</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#34d399' }}>{report.items[0].trc20_address}</span>
            </div>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                {['전략명','기간','분배가능소득','분윤','미지급 이익'].map(h => (
                  <th key={h} style={{ padding: '8px 20px', textAlign: 'left', fontFamily: 'var(--font-main)', fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.items.map((item, i) => (
                <tr key={item.id} style={{ borderBottom: i < report.items.length - 1 ? '1px solid var(--border-primary)' : 'none' }}>
                  <td style={{ padding: '10px 20px', fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-primary)' }}>{item.strategy_name}</td>
                  <td style={{ padding: '10px 20px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>—</td>
                  <td style={{ padding: '10px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>${fmt(item.distributable_income)}</td>
                  <td style={{ padding: '10px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#fbbf24' }}>{(item.profit_ratio * 100).toFixed(0)}%</td>
                  <td style={{ padding: '10px 20px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#34d399' }}>${fmt(item.unpaid_profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── CSV 내보내기 ─────────────────────────────────────────────────────────────
function downloadCsv(reports: ProfitReportWithItems[]) {
  const rows: string[] = ['Address,Amount,Currency,Remark']
  for (const r of reports) {
    const addr   = r.items[0]?.trc20_address ?? ''
    const name   = r.items[0]?.matched_name ?? ''
    const mt5    = r.items[0]?.mt5_account_id ?? ''
    const remark = `${name} ${mt5} ${r.date_from}~${r.date_to}`.trim()
    rows.push(`${addr},${r.total_unpaid.toFixed(2)},USDT,${remark}`)
  }
  const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `payout_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── 페이지 ──────────────────────────────────────────────────────────────────
export default function PayoutsPage() {
  const [reports, setReports]       = useState<ProfitReportWithItems[]>([])
  const [logs, setLogs]             = useState<CsvExportLog[]>([])
  const [loadError, setLoadError]   = useState('')
  const [loading, setLoading]       = useState(true)
  const [logsLoading, setLogsLoading] = useState(true)
  const [filter, setFilter]         = useState<'all' | 'pending' | 'confirmed' | 'paid' | 'failed'>('all')
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [exporting, setExporting]   = useState(false)

  // Binance 결과 CSV
  const [binanceRows, setBinanceRows]   = useState<BinanceResultRow[] | null>(null)
  const [binanceBusy, setBinanceBusy]   = useState(false)
  const [binanceDrag, setBinanceDrag]   = useState(false)
  const [binanceErr, setBinanceErr]     = useState('')
  const [binanceResult, setBinanceResult] = useState<{ failedCount: number; paidCount: number } | null>(null)
  const binanceRef = useRef<HTMLInputElement>(null)

  // 낙전 조회
  const [missingFrom, setMissingFrom]       = useState('')
  const [missingTo, setMissingTo]           = useState('')
  const [missingList, setMissingList]       = useState<MissingMember[] | null>(null)
  const [missingLoading, setMissingLoading] = useState(false)

  async function load() {
    setLoading(true); setLoadError('')
    try { setReports(await adminGetProfitReports()) }
    catch (e: any) { setLoadError(e?.message ?? '보고서 로딩 실패') }
    finally { setLoading(false) }
  }

  async function loadLogs() {
    setLogsLoading(true)
    try { setLogs(await adminGetCsvExportLogs()) }
    catch (e: any) { console.error(e) }
    finally { setLogsLoading(false) }
  }

  useEffect(() => { load(); loadLogs() }, [])

  const displayed  = filter === 'all' ? reports : reports.filter(r => r.status === filter)
  const confirmed  = reports.filter(r => r.status === 'confirmed')

  const totals = {
    pending:   reports.filter(r => r.status === 'pending').reduce((s,r) => s + r.total_unpaid, 0),
    confirmed: confirmed.reduce((s,r) => s + r.total_unpaid, 0),
    paid:      reports.filter(r => r.status === 'paid').reduce((s,r) => s + r.total_unpaid, 0),
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    const confirmIds = confirmed.map(r => r.id)
    const allChecked = confirmIds.every(id => selected.has(id))
    setSelected(allChecked ? new Set() : new Set(confirmIds))
  }

  const selectedReports  = confirmed.filter(r => selected.has(r.id))
  const selectedTotal    = selectedReports.reduce((s, r) => s + r.total_unpaid, 0)
  const allConfirmedSel  = confirmed.length > 0 && confirmed.every(r => selected.has(r.id))

  return (
    <>
    {binanceResult && <BinanceResultModal result={binanceResult} onClose={() => setBinanceResult(null)} />}
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes sk { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes spin   { to { transform:rotate(360deg) } }
        .bn-panel { animation: fadeUp 0.3s cubic-bezier(0.16,1,0.3,1) both }
        .bn-item  { animation: fadeIn 0.25s ease both }
      `}</style>

      {/* 헤더 */}
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-main)', marginBottom: 4 }}>수당 지급 관리</h1>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-main)' }}>
          Vantage 복사기 이익 공유 보고서 PDF 업로드 → 노드 자동 매칭 → 지급 확정
        </p>
      </div>

      {loadError && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontFamily: 'var(--font-main)', fontSize: 13, color: '#f87171' }}>
          ⚠ {loadError}
        </div>
      )}

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: '미확인 (대기)', value: totals.pending, color: '#fbbf24', count: reports.filter(r => r.status === 'pending').length },
          { label: '확인됨 (지급 대기)', value: totals.confirmed, color: '#60a5fa', count: confirmed.length },
          { label: '지급 완료', value: totals.paid, color: '#34d399', count: reports.filter(r => r.status === 'paid').length },
        ].map(item => (
          <div key={item.label} style={{ background: 'var(--bg-surface)', border: `1px solid ${item.color}30`, borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)' }}>{item.label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: item.color, background: item.color + '18', border: `1px solid ${item.color}44`, padding: '1px 7px', borderRadius: 4 }}>{item.count}건</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: item.color }}>${loading ? '—' : fmt(item.value)}</div>
          </div>
        ))}
      </div>

      {/* CSV 내보내기 패널 — confirmed 보고서가 있을 때만 표시 */}
      {confirmed.length > 0 && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid #60a5fa33', borderRadius: 10, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-main)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
                Binance 일괄전송 CSV
              </div>
              <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                확인됨 상태 보고서를 선택해 CSV로 내보냅니다 (Address, Amount, Currency, Remark)
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {selected.size > 0 && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#60a5fa' }}>
                  {selected.size}건 · ${fmt(selectedTotal)}
                </span>
              )}
              <button
                onClick={toggleAll}
                style={{ padding: '6px 14px', borderRadius: 5, fontFamily: 'var(--font-main)', fontSize: 12, cursor: 'pointer', background: allConfirmedSel ? 'rgba(96,165,250,0.1)' : 'transparent', border: '1px solid var(--border-secondary)', color: 'var(--text-secondary)' }}
              >
                {allConfirmedSel ? '전체 해제' : '전체 선택'}
              </button>
              <button
                onClick={async () => {
                  if (!selectedReports.length || exporting) return
                  setExporting(true)
                  try {
                    downloadCsv(selectedReports)
                    await adminSaveCsvExportLog(selectedReports)
                    setSelected(new Set())
                    await loadLogs()
                  } catch (e: any) { alert(e?.message ?? '오류') }
                  finally { setExporting(false) }
                }}
                disabled={selected.size === 0 || exporting}
                style={{ padding: '6px 16px', borderRadius: 5, fontFamily: 'var(--font-main)', fontSize: 12, fontWeight: 600, cursor: selected.size === 0 ? 'not-allowed' : 'pointer', background: selected.size > 0 ? '#60a5fa' : 'var(--bg-inset)', border: 'none', color: selected.size > 0 ? '#000' : 'var(--text-tertiary)', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6, opacity: exporting ? 0.6 : 1 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                {exporting ? '저장 중...' : 'CSV 다운로드'}
              </button>
            </div>
          </div>

          {/* 체크박스 목록 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {confirmed.map(r => {
              const isSel = selected.has(r.id)
              const addr  = r.items[0]?.trc20_address
              const name  = r.items[0]?.matched_name ?? '—'
              const mt5   = r.items[0]?.mt5_account_id ?? '—'
              return (
                <div
                  key={r.id}
                  onClick={() => toggleSelect(r.id)}
                  style={{
                    display: 'grid', gridTemplateColumns: '20px 1fr 1fr 1fr auto',
                    gap: 16, alignItems: 'center',
                    padding: '10px 14px', borderRadius: 7, cursor: 'pointer',
                    background: isSel ? 'rgba(96,165,250,0.06)' : 'var(--bg-inset)',
                    border: `1px solid ${isSel ? '#60a5fa44' : 'var(--border-primary)'}`,
                    transition: 'all 0.12s',
                  }}
                >
                  {/* 체크박스 */}
                  <div style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                    background: isSel ? '#60a5fa' : 'transparent',
                    border: `2px solid ${isSel ? '#60a5fa' : 'var(--border-secondary)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.12s',
                  }}>
                    {isSel && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>

                  {/* 이름 + MT5 */}
                  <div>
                    <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#60a5fa', marginTop: 2 }}>{mt5}</div>
                  </div>

                  {/* TRC-20 주소 */}
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: addr ? '#34d399' : '#f87171', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {addr ?? '지갑 미등록'}
                  </div>

                  {/* 기간 */}
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {r.date_from} ~ {r.date_to}
                  </div>

                  {/* 금액 */}
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#34d399', textAlign: 'right' }}>
                    ${fmt(r.total_unpaid)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Binance 전송 결과 처리 ── */}
      <input ref={binanceRef} type="file" accept=".csv" style={{ display: 'none' }}
        onChange={async e => {
          const file = e.target.files?.[0]
          if (!file) return
          setBinanceBusy(true); setBinanceErr(''); setBinanceRows(null); setBinanceResult(null)
          try {
            const { data: { session: s } } = await supabase.auth.getSession()
            const form = new FormData(); form.append('file', file)
            const res  = await fetch('/api/parse-binance-result', { method: 'POST', body: form, headers: { Authorization: `Bearer ${s?.access_token ?? ''}` } })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error)
            setBinanceRows(json.rows as BinanceResultRow[])
          } catch (err: any) { setBinanceErr(err.message) }
          finally { setBinanceBusy(false); e.target.value = '' }
        }}
      />
      {/* 하나의 카드 안에서 좌(정보) + 우(업로드존 or 미리보기) 2컬럼 */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', height: 220 }}>

        {/* 좌: 정보 영역 */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, borderRight: '1px solid var(--border-primary)', overflow: 'hidden' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-main)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Binance 전송 결과 처리</div>
            <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.7 }}>
              일괄전송 후 결과 CSV를 업로드하면 성공/실패 상태가 자동 반영됩니다
            </div>
          </div>

          {binanceErr && <div className="bn-item" style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: '#f87171' }}>⚠ {binanceErr}</div>}

          {/* CSV 형식 안내 */}
          <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>CSV 형식</span>
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', background: 'var(--bg-inset)', borderRadius: 4, padding: '5px 10px', lineHeight: 1.8, display: 'block' }}>
              No. · Address · Amount · Currency · Status · Remark · Reason
            </code>
            <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)' }}>
              Status: <span style={{ color: '#34d399', fontFamily: 'var(--font-mono)' }}>Success</span> / <span style={{ color: '#f87171', fontFamily: 'var(--font-mono)' }}>Failed</span>
            </span>
          </div>
        </div>

        {/* 우: 업로드존 (idle) 또는 파싱 미리보기 */}
        {!binanceRows && !binanceResult && (
          <div key="idle" className="bn-panel"
            onClick={() => !binanceBusy && binanceRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setBinanceDrag(true) }}
            onDragLeave={() => setBinanceDrag(false)}
            onDrop={async e => {
              e.preventDefault(); setBinanceDrag(false)
              const file = e.dataTransfer.files[0]
              if (!file) return
              if (!file.name.endsWith('.csv')) { setBinanceErr('CSV 파일만 지원합니다'); return }
              setBinanceBusy(true); setBinanceErr(''); setBinanceRows(null); setBinanceResult(null)
              try {
                const { data: { session: s } } = await supabase.auth.getSession()
                const form = new FormData(); form.append('file', file)
                const res  = await fetch('/api/parse-binance-result', { method: 'POST', body: form, headers: { Authorization: `Bearer ${s?.access_token ?? ''}` } })
                const json = await res.json()
                if (!res.ok) throw new Error(json.error)
                setBinanceRows(json.rows as BinanceResultRow[])
              } catch (err: any) { setBinanceErr(err.message) }
              finally { setBinanceBusy(false) }
            }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, cursor: binanceBusy ? 'wait' : 'pointer', borderRadius: '0 10px 10px 0', background: binanceDrag ? 'rgba(248,113,113,0.07)' : 'transparent', outline: binanceDrag ? '2px dashed #f87171' : '2px dashed #f8717130', outlineOffset: -8, transition: 'all 0.15s' }}>
            {binanceBusy
              ? <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2.5px solid #f8717133', borderTopColor: '#f87171', animation: 'spin 0.8s linear infinite' }}/>
              : <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={binanceDrag ? '#f87171' : '#f8717166'} strokeWidth="1.5" strokeLinecap="round" style={{ transition: 'stroke 0.15s' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            }
            <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
              <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, color: binanceDrag ? '#f87171' : 'var(--text-secondary)', transition: 'color 0.15s' }}>
                {binanceBusy ? '분석 중...' : binanceDrag ? '여기에 놓으세요' : '드래그하거나 클릭해서 업로드'}
              </div>
              {!binanceBusy && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>.csv</div>
              )}
            </div>
          </div>
        )}

        {binanceRows && !binanceResult && (
          <div key="preview" className="bn-panel" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <span style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: '#34d399' }}>✓ 성공 {binanceRows.filter(r => r.status === 'success').length}건</span>
              <span style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: '#f87171' }}>✗ 실패 {binanceRows.filter(r => r.status === 'failed').length}건</span>
            </div>
            {binanceRows.some(r => r.status === 'failed') && (
              <div style={{ flex: 1, background: 'var(--bg-inset)', border: '1px solid var(--border-primary)', borderRadius: 7, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-primary)', fontFamily: 'var(--font-main)', fontSize: 11, fontWeight: 600, color: '#f87171', flexShrink: 0 }}>실패 항목</div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {binanceRows.filter(r => r.status === 'failed').map((r, i, arr) => (
                    <div key={i} className="bn-item" style={{ padding: '10px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-primary)' : 'none', display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', animationDelay: `${i * 60}ms` }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.address}</div>
                        {r.reason && <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>{r.reason}</div>}
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#f87171', fontWeight: 600 }}>${r.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexShrink: 0 }}>
              <button onClick={() => { setBinanceRows(null); setBinanceErr('') }}
                style={{ flex: 1, padding: '7px', borderRadius: 6, fontFamily: 'var(--font-main)', fontSize: 12, cursor: 'pointer', background: 'transparent', border: '1px solid var(--border-secondary)', color: 'var(--text-secondary)' }}>취소</button>
              <button onClick={async () => { setBinanceBusy(true); try { const r = await adminApplyBinanceResult(binanceRows); setBinanceResult(r); setBinanceRows(null); await load() } catch (err: any) { setBinanceErr(err.message) } finally { setBinanceBusy(false) } }} disabled={binanceBusy}
                style={{ flex: 2, padding: '7px', borderRadius: 6, fontFamily: 'var(--font-main)', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#f87171', border: 'none', color: '#000', opacity: binanceBusy ? 0.6 : 1 }}>
                {binanceBusy ? '처리 중...' : '결과 반영'}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── 낙전 조회 ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-main)', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>낙전 조회 — 미제출 회원</span>
          {/* 날짜 + 조회 | CSV */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DatePicker value={missingFrom} onChange={setMissingFrom} placeholder="시작일" />
            <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>~</span>
            <DatePicker value={missingTo} onChange={setMissingTo} placeholder="종료일" />
            <button
              onClick={async () => {
                if (!missingFrom || !missingTo) return
                setMissingLoading(true); setMissingList(null)
                try { setMissingList(await adminGetMissingMembers(missingFrom, missingTo)) }
                catch (e: any) { alert(e?.message ?? '오류') }
                finally { setMissingLoading(false) }
              }}
              disabled={!missingFrom || !missingTo || missingLoading}
              style={{ padding: '7px 16px', borderRadius: 6, fontFamily: 'var(--font-main)', fontSize: 12, fontWeight: 600, cursor: missingFrom && missingTo ? 'pointer' : 'not-allowed', background: missingFrom && missingTo ? '#fbbf24' : 'var(--bg-inset)', border: 'none', color: missingFrom && missingTo ? '#000' : 'var(--text-tertiary)', opacity: missingLoading ? 0.6 : 1, transition: 'all 0.15s' }}>
              {missingLoading ? '조회 중...' : '조회'}
            </button>
            {/* 구분선 */}
            {missingList !== null && missingList.length > 0 && (
              <>
                <div style={{ width: 1, height: 20, background: 'var(--border-secondary)', margin: '0 4px' }} />
                <button
                  onClick={() => {
                    const rows = ['이름,MT5계좌,TRC20주소,노드ID,가입일,낙전사유']
                    missingList.forEach(m => rows.push(`${m.name},${m.mt5_account_id},${m.trc20_address ?? ''},${m.node_id},${m.created_at?.slice(0,10) ?? ''},${m.trc20_address === null ? 'TRC-20 미등록' : 'PDF 미제출'}`))
                    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a'); a.href = url
                    a.download = `missing_${missingFrom}_${missingTo}.csv`; a.click()
                    URL.revokeObjectURL(url)
                  }}
                  style={{ padding: '7px 12px', borderRadius: 6, fontFamily: 'var(--font-main)', fontSize: 12, cursor: 'pointer', background: 'rgba(251,191,36,0.1)', border: '1px solid #fbbf2444', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  CSV
                </button>
              </>
            )}
          </div>
        </div>

        {missingList === null ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)', background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10 }}>
            기간을 선택하고 조회하세요
          </div>
        ) : missingList.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', fontFamily: 'var(--font-main)', fontSize: 13, color: '#34d399', background: 'var(--bg-surface)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 10 }}>
            ✓ 미제출 회원 없음 — 모두 보고서를 제출했습니다
          </div>
        ) : (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '13%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '40%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '14%' }} />
              </colgroup>
              <thead>
                <tr style={{ background: 'rgba(10,12,16,0.3)', borderBottom: '1px solid var(--border-primary)' }}>
                  {['이름', 'MT5 계좌', 'TRC-20 주소', '노드 ID', '가입일', '낙전 사유'].map(h => (
                    <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontFamily: 'var(--font-main)', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {missingList.map((m, i) => (
                  <tr key={m.id} style={{ borderBottom: i < missingList.length - 1 ? '1px solid var(--border-primary)' : 'none' }}>
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{m.name}</td>
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#60a5fa' }}>{m.mt5_account_id}</td>
                    <td style={{ padding: '12px 20px' }}>
                      {m.trc20_address
                        ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#34d399', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{m.trc20_address}</span>
                        : <span style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: '#f87171' }}>미등록</span>
                      }
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{m.node_id}</td>
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{m.created_at?.slice(0, 10) ?? '—'}</td>
                    <td style={{ padding: '12px 20px' }}>
                      {m.trc20_address === null
                        ? <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid #f8717130', borderRadius: 4, padding: '2px 8px' }}>TRC-20 미등록</span>
                        : <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: '#fbbf24', background: 'rgba(251,191,36,0.08)', border: '1px solid #fbbf2430', borderRadius: 4, padding: '2px 8px' }}>PDF 미제출</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 보고서 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-main)', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>보고서 이력</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all','pending','confirmed','failed','paid'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '4px 12px', borderRadius: 4, fontFamily: 'var(--font-main)', fontSize: 11, cursor: 'pointer', border: '1px solid', transition: 'all 0.15s',
                borderColor: filter === f ? 'var(--accent-blue)' : 'var(--border-secondary)',
                background: filter === f ? 'var(--accent-blue-dim)' : 'transparent',
                color: filter === f ? 'var(--accent-blue)' : 'var(--text-tertiary)',
              }}>
                {f === 'all' ? '전체' : STATUS_LABEL[f]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skeleton w="40%" h={14}/><Skeleton w="60%" h={12}/>
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)', background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10 }}>
            보고서가 없습니다
          </div>
        ) : (
          displayed.map(r => <ReportCard key={r.id} report={r} onRefresh={load}/>)
        )}
      </div>

      {/* CSV 발급 이력 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-main)', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>CSV 발급 이력</span>
          <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)' }}>최근 50건</span>
        </div>

        {logsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1,2].map(i => (
              <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: '14px 20px', display: 'flex', gap: 16 }}>
                <Skeleton w="18%" h={13}/><Skeleton w="12%" h={13}/><Skeleton w="10%" h={13}/>
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)', background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10 }}>
            발급 이력이 없습니다
          </div>
        ) : (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(10,12,16,0.3)', borderBottom: '1px solid var(--border-primary)' }}>
                  {['발급일시', '포함 건수', '총 지급액', '메모'].map(h => (
                    <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontFamily: 'var(--font-main)', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log.id} style={{ borderBottom: i < logs.length - 1 ? '1px solid var(--border-primary)' : 'none' }}>
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                      <div>{log.exported_at.slice(0, 10)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{log.exported_at.slice(11, 19)}</div>
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#60a5fa', background: '#60a5fa18', border: '1px solid #60a5fa44', padding: '2px 8px', borderRadius: 4 }}>
                        {log.report_count}건
                      </span>
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: '#34d399' }}>
                      ${log.total_amount.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {log.note ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
    </>
  )
}
