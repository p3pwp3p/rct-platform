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

const fmt = (n: number) => n.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function PayoutConfirmPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = use(params)
  const showToast = useToast()
  const { data, isLoading, error, mutate } = useApi<Detail>(`/api/admin/payout-confirm?reportId=${reportId}`)
  const [tab, setTab]   = useState<'account' | 'node'>('account')
  const [busy, setBusy] = useState(false)

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
