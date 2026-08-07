'use client'
import { use, useState } from 'react'
import Link from 'next/link'
import { useApi } from '@/lib/swr'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ToastProvider'

/**
 * 수당 지급 컨펌 화면.
 * 여기서 승인해야 회원 화면에 금액이 보인다(그 전엔 "정산 준비중"으로만 표시).
 * 승인 전에 누구에게 얼마인지 계정/노드 단위로 전부 확인할 수 있어야 한다.
 */
type Acc = {
  accountId: string; name: string; trc20: string | null; nodeIds: string[]
  referral: number; rank: number; sponsor: number; total: number
}
type NodeRow = {
  profileId: string; nodeId: string; name: string; nodeRank: string
  referral: number; rank: number; sponsor: number; total: number
}
type Detail = {
  report: { id: string; date_from: string; date_to: string; status: string; total_unpaid: number }
  isConfirmed: boolean
  hasCalc: boolean
  totals: { referral: number; rank: number; sponsor: number; total: number }
  forfeited: number
  rowCount: number
  accounts: Acc[]
  nodes: NodeRow[]
  missingWallet: { name: string; nodeIds: string[]; total: number }[]
}

type Transfer = {
  id: string; name: string | null; node_ids: string | null; address: string | null
  amount: number; status: string; reason: string | null; applied_at: string | null
}
type TSummary = {
  total: number; pending: number; success: number; failed: number; noWallet: number
  amountTotal: number; amountSuccess: number; amountFailed: number
  amountPending: number; amountNoWallet: number
}
const TF_LABEL: Record<string, { text: string; color: string }> = {
  pending:   { text: '송금 대기', color: '#fbbf24' },
  success:   { text: '지급 완료', color: '#34d399' },
  failed:    { text: '송금 실패', color: '#f87171' },
  no_wallet: { text: '주소 미등록', color: '#94a3b8' },
}

type XRow = {
  account: string; name: string; nodes: string[]
  reportAmount: number | null; pdfAmount: number | null
  diff: number | null; status: 'match' | 'mismatch' | 'pdf_only' | 'report_only'
  pdfPeriod: string | null; pdfFiles: number
}
type XSummary = {
  total: number; match: number; mismatch: number; pdfOnly: number; reportOnly: number
  reportTotal: number; pdfTotal: number; checkedDiff: number; allClear: boolean
}
const X_LABEL: Record<XRow['status'], { text: string; color: string }> = {
  match:       { text: '일치',        color: '#34d399' },
  mismatch:    { text: '금액 불일치',  color: '#f87171' },
  pdf_only:    { text: 'PDF에만 있음', color: '#fbbf24' },
  report_only: { text: 'PDF 미제출',   color: '#94a3b8' },
}

const fmt = (n: number) => n.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function PayoutConfirmPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = use(params)
  const showToast = useToast()
  const { data, isLoading, error, mutate } = useApi<Detail>(`/api/admin/payout-confirm?reportId=${reportId}`)
  // 송금 현황(계정별) — 컨펌 시 스냅샷이 생기고, Binance 결과를 반영하면 갱신된다
  const { data: tf } = useApi<{ transfers: Transfer[]; summary: TSummary | null; available: boolean }>(
    `/api/admin/payout-transfer?reportId=${reportId}`)
  const [tab, setTab]   = useState<'account' | 'node'>('account')
  const [busy, setBusy] = useState(false)

  // PDF 크로스체크 — 엑셀로 만든 보고서를 거래소 PDF 원본과 대조
  const [xBusy, setXBusy]   = useState(false)
  const [xRows, setXRows]   = useState<XRow[] | null>(null)
  const [xSum, setXSum]     = useState<XSummary | null>(null)
  const [xErr, setXErr]     = useState('')
  const [xProgress, setXProgress] = useState('')

  const runCrosscheck = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setXBusy(true); setXErr(''); setXRows(null); setXSum(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''

      // PDF 는 한 장씩 파싱 — 실패한 파일은 건너뛰되 몇 개인지 알려준다
      const parsed: unknown[] = []
      const failed: string[] = []
      for (let i = 0; i < files.length; i++) {
        setXProgress(`PDF 읽는 중 ${i + 1}/${files.length}`)
        const form = new FormData()
        form.append('file', files[i])
        const res = await fetch('/api/parse-pdf', { method: 'POST', body: form, headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) { failed.push(files[i].name); continue }
        parsed.push(await res.json())
      }
      if (parsed.length === 0) throw new Error('읽을 수 있는 PDF 가 없습니다.')

      setXProgress('대조 중...')
      const res = await fetch('/api/admin/payout-crosscheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reportId, pdfs: parsed }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '대조 실패')
      setXRows(json.rows); setXSum(json.summary)
      if (failed.length) setXErr(`읽지 못한 파일 ${failed.length}건: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? ' 외' : ''}`)
    } catch (e: unknown) {
      setXErr(e instanceof Error ? e.message : '대조 오류')
    } finally { setXBusy(false); setXProgress('') }
  }

  const act = async (action: 'confirm' | 'unconfirm') => {
    const msg = action === 'confirm'
      ? `${data?.accounts.length ?? 0}개 계정에 총 $${fmt(data?.totals.total ?? 0)} 지급을 확정할까요?\n확정하면 회원 화면에 금액이 공개됩니다.`
      : '컨펌을 해제하면 회원 화면에서 금액이 다시 숨겨집니다. 진행할까요?'
    if (!confirm(msg)) return
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/payout-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ reportId, action }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '처리 실패')
      showToast(action === 'confirm' ? '지급이 확정되어 회원에게 공개됩니다' : '컨펌을 해제했습니다', 'success')
      mutate()
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '오류', 'error')
    } finally { setBusy(false) }
  }

  if (isLoading) return <div style={{ padding: 32, fontFamily: 'var(--font-main)', fontSize: 14, color: 'var(--text-tertiary)' }}>불러오는 중...</div>
  if (error || !data) return <div style={{ padding: 32, fontFamily: 'var(--font-main)', fontSize: 14, color: '#f87171' }}>⚠ 불러오지 못했습니다.</div>

  const d = data
  const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10 }
  const th: React.CSSProperties = { fontFamily: 'var(--font-main)', fontSize: 11.5, fontWeight: 600, color: 'var(--text-tertiary)', padding: '9px 12px', textAlign: 'left', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-secondary)', padding: '9px 12px', borderTop: '1px solid var(--border-primary)' }
  const num: React.CSSProperties = { ...td, fontFamily: 'var(--font-mono)', textAlign: 'right', whiteSpace: 'nowrap' }

  return (
    <div style={{ padding: 32, maxWidth: 1180 }}>
      <Link href="/admin/payouts" style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)' }}>← 수당 지급 관리</Link>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, margin: '10px 0 6px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-main)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>수당 지급 컨펌</h1>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
            {d.report.date_from} ~ {d.report.date_to} · 분배 {d.rowCount}건
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontFamily: 'var(--font-main)', fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 999,
            color: d.isConfirmed ? '#34d399' : '#fbbf24',
            background: d.isConfirmed ? 'rgba(52,211,153,0.12)' : 'rgba(251,191,36,0.12)',
            border: `1px solid ${d.isConfirmed ? 'rgba(52,211,153,0.35)' : 'rgba(251,191,36,0.35)'}`,
          }}>
            {d.report.status === 'paid' ? '지급 완료' : d.isConfirmed ? '컨펌됨 · 회원 공개중' : '미컨펌 · 회원에게 숨김'}
          </span>
          {d.report.status !== 'paid' && (
            d.isConfirmed ? (
              <button onClick={() => act('unconfirm')} disabled={busy}
                style={{ padding: '9px 18px', borderRadius: 7, border: '1px solid var(--border-secondary)', background: 'transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-main)', fontSize: 13, cursor: busy ? 'wait' : 'pointer' }}>
                컨펌 해제
              </button>
            ) : (
              <button onClick={() => act('confirm')} disabled={busy || !d.hasCalc}
                style={{
                  padding: '9px 20px', borderRadius: 7, border: 'none',
                  background: d.hasCalc ? '#4db6ac' : 'var(--bg-inset)',
                  color: d.hasCalc ? '#04110f' : 'var(--text-tertiary)',
                  fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 700,
                  cursor: (busy || !d.hasCalc) ? 'not-allowed' : 'pointer',
                }}>
                {busy ? '처리 중...' : '지급 확정 (회원 공개)'}
              </button>
            )
          )}
        </div>
      </div>

      {!d.hasCalc && (
        <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 8, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', fontFamily: 'var(--font-main)', fontSize: 13, color: '#fbbf24' }}>
          수당 계산 결과가 없습니다. 수당 지급 관리에서 계산을 실행하고 저장한 뒤 컨펌하세요.
        </div>
      )}

      {d.missingWallet.length > 0 && (
        <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, color: '#f87171', marginBottom: 6 }}>
            지갑주소(TRC-20) 미등록 {d.missingWallet.length}건 — 송금 불가
          </div>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {d.missingWallet.map((m, i) => (
              <span key={i}>{m.name}({m.nodeIds.join(',')}) ${fmt(m.total)}{i < d.missingWallet.length - 1 ? ' · ' : ''}</span>
            ))}
          </div>
        </div>
      )}

      {/* 합계 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, margin: '18px 0' }}>
        {[
          { label: '추천수당',   value: d.totals.referral, color: '#fbbf24' },
          { label: '직급수당',   value: d.totals.rank,     color: '#60a5fa' },
          { label: '후원수당',   value: d.totals.sponsor,  color: '#c084fc' },
          { label: '낙전(회사)', value: d.forfeited,       color: '#f87171' },
          { label: '총 지급액',  value: d.totals.total,    color: '#34d399', strong: true },
        ].map((s, i) => (
          <div key={i} style={{ ...card, padding: '13px 15px' }}>
            <div style={{ fontFamily: 'var(--font-main)', fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 5 }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: s.strong ? 18 : 15, fontWeight: s.strong ? 700 : 500, color: s.color }}>
              ${fmt(s.value)}
            </div>
          </div>
        ))}
      </div>

      {/* PDF 크로스체크 — 컨펌 전에 엑셀 금액이 원본과 맞는지 확인 */}
      <div style={{ ...card, padding: 16, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontFamily: 'var(--font-main)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>PDF 크로스체크</span>
            <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>
              거래소 PDF 를 올리면 엑셀로 만든 금액과 계정번호별로 대조합니다 (여러 장 선택 가능)
            </div>
          </div>
          <label style={{
            padding: '8px 16px', borderRadius: 7, cursor: xBusy ? 'wait' : 'pointer',
            background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.35)',
            color: '#60a5fa', fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600,
          }}>
            {xBusy ? (xProgress || '처리 중...') : 'PDF 선택'}
            <input type="file" accept="application/pdf" multiple disabled={xBusy}
              onChange={e => { runCrosscheck(e.target.files); e.target.value = '' }}
              style={{ display: 'none' }} />
          </label>
        </div>

        {xErr && (
          <div style={{ marginTop: 12, padding: '9px 12px', borderRadius: 7, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', fontFamily: 'var(--font-main)', fontSize: 12.5, color: '#fbbf24' }}>
            {xErr}
          </div>
        )}

        {xSum && (
          <>
            <div style={{
              marginTop: 14, padding: '11px 14px', borderRadius: 8,
              background: xSum.allClear ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)',
              border: `1px solid ${xSum.allClear ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
              fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600,
              color: xSum.allClear ? '#34d399' : '#f87171',
            }}>
              {xSum.allClear
                ? `대조 완료 — 불일치 없음 (검증 ${xSum.match}건)`
                : `확인 필요 — 불일치 ${xSum.mismatch}건${xSum.pdfOnly > 0 ? `, PDF에만 있는 계정 ${xSum.pdfOnly}건` : ''}`}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8, marginTop: 12 }}>
              {[
                { label: '보고서 합계', value: `$${fmt(xSum.reportTotal)}`, color: 'var(--text-primary)' },
                { label: 'PDF 합계',    value: `$${fmt(xSum.pdfTotal)}`,    color: 'var(--text-primary)' },
                { label: '검증분 차액', value: `$${fmt(xSum.checkedDiff)}`, color: Math.abs(xSum.checkedDiff) < 0.01 ? '#34d399' : '#f87171' },
                { label: 'PDF 미제출',  value: `${xSum.reportOnly}건`,      color: xSum.reportOnly > 0 ? '#94a3b8' : '#34d399' },
              ].map((k, i) => (
                <div key={i} style={{ padding: '10px 12px', borderRadius: 7, background: 'var(--bg-inset)' }}>
                  <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                <thead style={{ background: 'var(--bg-inset)' }}>
                  <tr>
                    <th style={th}>상태</th>
                    <th style={th}>계정번호</th>
                    <th style={th}>이름 / 노드</th>
                    <th style={{ ...th, textAlign: 'right' }}>보고서</th>
                    <th style={{ ...th, textAlign: 'right' }}>PDF</th>
                    <th style={{ ...th, textAlign: 'right' }}>차액</th>
                  </tr>
                </thead>
                <tbody>
                  {(xRows ?? []).map((r, i) => {
                    const L = X_LABEL[r.status]
                    return (
                      <tr key={i}>
                        <td style={{ ...td, color: L.color, fontWeight: 600, fontSize: 12 }}>{L.text}</td>
                        <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.account}</td>
                        <td style={{ ...td, fontSize: 12 }}>
                          {r.name || '—'}
                          {r.nodes.length > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-tertiary)' }}> {r.nodes.join(', ')}</span>}
                        </td>
                        <td style={num}>{r.reportAmount == null ? '—' : fmt(r.reportAmount)}</td>
                        <td style={num}>{r.pdfAmount == null ? '—' : fmt(r.pdfAmount)}</td>
                        <td style={{ ...num, color: r.diff == null ? 'var(--text-tertiary)' : Math.abs(r.diff) < 0.01 ? 'var(--text-tertiary)' : '#f87171', fontWeight: r.diff && Math.abs(r.diff) >= 0.01 ? 700 : 400 }}>
                          {r.diff == null ? '—' : fmt(r.diff)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* 송금 현황 — 컨펌 후 스냅샷이 생기고 Binance 결과 반영 시 갱신 */}
      {tf?.available && tf.summary && tf.summary.total > 0 && (
        <div style={{ ...card, padding: 16, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
            <span style={{ fontFamily: 'var(--font-main)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>송금 현황</span>
            <span style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)' }}>
              계정별로 개별 기록됩니다 — Binance 결과 CSV 를 올리면 갱신됩니다
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {([
              ['success',   tf.summary.success,  tf.summary.amountSuccess],
              ['pending',   tf.summary.pending,  tf.summary.amountPending],
              ['failed',    tf.summary.failed,   tf.summary.amountFailed],
              ['no_wallet', tf.summary.noWallet, tf.summary.amountNoWallet],
            ] as const).filter(([, c]) => c > 0).map(([k, c, amt]) => (
              <span key={k} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999,
                fontFamily: 'var(--font-main)', fontSize: 12.5,
                background: `${TF_LABEL[k].color}14`, border: `1px solid ${TF_LABEL[k].color}44`, color: TF_LABEL[k].color,
              }}>
                {TF_LABEL[k].text} {c}건
                <span style={{ fontFamily: 'var(--font-mono)' }}>${fmt(amt)}</span>
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {tf.transfers.map(t => {
              const L = TF_LABEL[t.status] ?? { text: t.status, color: 'var(--text-tertiary)' }
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 7, background: 'var(--bg-inset)' }}>
                  <span style={{ flexShrink: 0, width: 88, fontFamily: 'var(--font-main)', fontSize: 11.5, fontWeight: 700, color: L.color }}>{L.text}</span>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.name} <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{t.node_ids}</span>
                  </span>
                  {t.reason && <span style={{ fontFamily: 'var(--font-main)', fontSize: 11.5, color: '#f87171' }}>{t.reason}</span>}
                  <span style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {t.address ? `${t.address.slice(0, 6)}…${t.address.slice(-4)}` : '주소없음'}
                  </span>
                  <span style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: L.color, minWidth: 80, textAlign: 'right' }}>
                    ${fmt(Number(t.amount))}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {([['account', `계정별 (${d.accounts.length})`], ['node', `노드별 (${d.nodes.length})`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{
              padding: '7px 16px', borderRadius: 7, fontFamily: 'var(--font-main)', fontSize: 13, cursor: 'pointer',
              background: tab === k ? 'rgba(77,182,172,0.12)' : 'transparent',
              border: `1px solid ${tab === k ? 'rgba(77,182,172,0.4)' : 'var(--border-secondary)'}`,
              color: tab === k ? '#4db6ac' : 'var(--text-tertiary)', fontWeight: tab === k ? 700 : 500,
            }}>
            {label}
          </button>
        ))}
        <span style={{ alignSelf: 'center', marginLeft: 6, fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)' }}>
          {tab === 'account' ? '실제 송금 단위입니다' : '검증용 상세입니다'}
        </span>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
            <thead style={{ background: 'var(--bg-inset)' }}>
              <tr>
                {tab === 'account' ? (
                  <>
                    <th style={th}>이름</th><th style={th}>보유 노드</th><th style={th}>TRC-20</th>
                    <th style={{ ...th, textAlign: 'right' }}>추천</th>
                    <th style={{ ...th, textAlign: 'right' }}>직급</th>
                    <th style={{ ...th, textAlign: 'right' }}>후원</th>
                    <th style={{ ...th, textAlign: 'right' }}>지급액</th>
                  </>
                ) : (
                  <>
                    <th style={th}>Node ID</th><th style={th}>이름</th><th style={th}>직급</th>
                    <th style={{ ...th, textAlign: 'right' }}>추천</th>
                    <th style={{ ...th, textAlign: 'right' }}>직급수당</th>
                    <th style={{ ...th, textAlign: 'right' }}>후원</th>
                    <th style={{ ...th, textAlign: 'right' }}>합계</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {tab === 'account' ? d.accounts.map(a => (
                <tr key={a.accountId}>
                  <td style={{ ...td, color: 'var(--text-primary)', fontWeight: 600 }}>{a.name}</td>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{a.nodeIds.join(', ')}</td>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {a.trc20 ? `${a.trc20.slice(0, 6)}…${a.trc20.slice(-4)}` : <span style={{ color: '#f87171' }}>미등록</span>}
                  </td>
                  <td style={num}>{fmt(a.referral)}</td>
                  <td style={num}>{fmt(a.rank)}</td>
                  <td style={num}>{fmt(a.sponsor)}</td>
                  <td style={{ ...num, color: '#34d399', fontWeight: 700 }}>{fmt(a.total)}</td>
                </tr>
              )) : d.nodes.map(n => (
                <tr key={n.profileId}>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{n.nodeId}</td>
                  <td style={{ ...td, color: 'var(--text-primary)' }}>{n.name}</td>
                  <td style={{ ...td, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{n.nodeRank}</td>
                  <td style={num}>{fmt(n.referral)}</td>
                  <td style={num}>{fmt(n.rank)}</td>
                  <td style={num}>{fmt(n.sponsor)}</td>
                  <td style={{ ...num, color: '#34d399', fontWeight: 700 }}>{fmt(n.total)}</td>
                </tr>
              ))}
              <tr style={{ background: 'var(--bg-inset)' }}>
                <td style={{ ...td, fontWeight: 700, color: 'var(--text-primary)' }} colSpan={3}>합계</td>
                <td style={{ ...num, fontWeight: 700 }}>{fmt(d.totals.referral)}</td>
                <td style={{ ...num, fontWeight: 700 }}>{fmt(d.totals.rank)}</td>
                <td style={{ ...num, fontWeight: 700 }}>{fmt(d.totals.sponsor)}</td>
                <td style={{ ...num, fontWeight: 700, color: '#34d399' }}>{fmt(d.totals.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
