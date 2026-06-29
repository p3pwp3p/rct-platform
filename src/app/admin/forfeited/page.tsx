'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useIsMobile } from '@/lib/useIsMobile'

type ForfeitedRow = {
  id: string
  report_id: string | null
  profile_id: string
  amount: number
  reason: string
  created_at: string
  // joined
  profile_name: string
  profile_node_id: string
  profile_status: string
}

type SummaryRow = {
  reason: string
  total: number
  count: number
}

const REASON_LABEL: Record<string, string> = {
  suspended: '일시 정지',
  expelled:  '제명',
  manual:    '수동 처리',
  company:   '회사 귀속 (적격 직급자 없음)',
}
const REASON_COLOR: Record<string, string> = {
  suspended: '#fbbf24',
  expelled:  '#f87171',
  manual:    '#94a3b8',
  company:   '#4db6ac',
}

function fmt(n: number) {
  return n.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function Shimmer({ w = '70%', h = 14 }: { w?: string | number; h?: number }) {
  return <div style={{ height: h, width: w, borderRadius: 4, background: 'linear-gradient(90deg,var(--bg-inset) 25%,rgba(148,163,184,0.06) 50%,var(--bg-inset) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }}/>
}

export default function ForfeitedPage() {
  const [rows,    setRows]    = useState<ForfeitedRow[]>([])
  const [summary, setSummary] = useState<SummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const isMobile = useIsMobile()

  // 회사 매출 집계 (service-role API)
  type Revenue = { totalProfit: number; companyBase: number; memberPool: number; totalPaid: number; forfeiture: number; forfeitRecorded: number; companyTotal: number; reportCount: number }
  const [rev, setRev] = useState<Revenue | null>(null)

  // 수동 낙전 추가
  const [showAdd, setShowAdd]       = useState(false)
  const [addNodeId, setAddNodeId]   = useState('')
  const [addAmount, setAddAmount]   = useState('')
  const [addNote, setAddNote]       = useState('')
  const [addBusy, setAddBusy]       = useState(false)
  const [addErr, setAddErr]         = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      // 1. forfeited_bonuses 조회 (테이블명 수정: forfeited_payouts → forfeited_bonuses)
      const { data, error: e } = await supabase
        .from('forfeited_bonuses')
        .select('id, report_id, profile_id, amount, reason, created_at')
        .order('created_at', { ascending: false })
      if (e) throw e

      // 2. 프로필 수동 join (FK 구문 의존 없이)
      const profileIds = [...new Set((data ?? []).map((r: any) => r.profile_id))]
      const { data: profiles } = profileIds.length
        ? await supabase.from('profiles').select('id, name, node_id, status').in('id', profileIds)
        : { data: [] }
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))

      const mapped: ForfeitedRow[] = (data ?? []).map((r: any) => {
        const p = profileMap.get(r.profile_id) as any
        return {
          id:              r.id,
          report_id:       r.report_id,
          profile_id:      r.profile_id,
          amount:          r.amount,
          reason:          r.reason,
          created_at:      r.created_at,
          profile_name:    p?.name    ?? '알 수 없음',
          profile_node_id: p?.node_id ?? '',
          profile_status:  p?.status  ?? 'active',
        }
      })
      setRows(mapped)

      // 집계
      const map: Record<string, SummaryRow> = {}
      for (const r of mapped) {
        if (!map[r.reason]) map[r.reason] = { reason: r.reason, total: 0, count: 0 }
        map[r.reason].total += r.amount
        map[r.reason].count++
      }
      setSummary(Object.values(map))

      // 회사 매출 집계 (service-role API — RLS 무관하게 정확 집계)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const rr = await fetch('/api/company-revenue', { headers: { Authorization: `Bearer ${token}` } })
      if (rr.ok) setRev(await rr.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : (e as any)?.message ?? JSON.stringify(e) ?? '오류')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleAddManual() {
    setAddErr('')
    const amt = parseFloat(addAmount)
    if (!addNodeId.trim())    { setAddErr('노드 ID를 입력해주세요'); return }
    if (isNaN(amt) || amt <= 0) { setAddErr('금액을 올바르게 입력해주세요'); return }

    setAddBusy(true)
    try {
      // node_id로 profile 찾기
      const { data: pData } = await supabase
        .from('profiles').select('id').eq('node_id', addNodeId.trim().toUpperCase()).single()
      if (!pData) { setAddErr('해당 노드 ID를 찾을 수 없습니다'); setAddBusy(false); return }

      const { error: ie } = await supabase.from('forfeited_bonuses').insert({
        profile_id: pData.id,
        amount:     amt,
        reason:     'manual',
        created_at: new Date().toISOString(),
      })
      if (ie) throw ie
      setShowAdd(false); setAddNodeId(''); setAddAmount(''); setAddNote('')
      load()
    } catch (e: unknown) {
      setAddErr(e instanceof Error ? e.message : (e as any)?.message ?? JSON.stringify(e) ?? '오류')
    } finally {
      setAddBusy(false)
    }
  }

  const totalAll = rows.reduce((s, r) => s + r.amount, 0)

  return (
    <>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      <div style={{ padding: isMobile ? 16 : 28, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1200, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, fontFamily: 'var(--font-main)' }}>회사 매출</h1>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-main)' }}>
              회사에 귀속되는 모든 수익 — 기본 수익(20%)과 회원 미지급 낙전
            </p>
          </div>
          <button onClick={() => setShowAdd(v => !v)}
            style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid var(--border-secondary)', background: showAdd ? 'rgba(248,113,113,0.08)' : 'transparent', color: showAdd ? '#f87171' : 'var(--text-secondary)', fontFamily: 'var(--font-main)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            수동 낙전 추가
          </button>
        </div>

        {/* 수동 추가 폼 */}
        {showAdd && (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 8, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>수동 낙전 기록</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 12 }}>
              <div>
                <label style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 5 }}>노드 ID</label>
                <input value={addNodeId} onChange={e => setAddNodeId(e.target.value)} placeholder="RCT-00001"
                  style={{ width: '100%', padding: '8px 10px', boxSizing: 'border-box', background: 'var(--bg-inset)', border: '1px solid var(--border-secondary)', borderRadius: 5, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none' }}/>
              </div>
              <div>
                <label style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 5 }}>금액 (USDT)</label>
                <input value={addAmount} onChange={e => setAddAmount(e.target.value)} placeholder="0.00" type="number" min="0" step="0.01"
                  style={{ width: '100%', padding: '8px 10px', boxSizing: 'border-box', background: 'var(--bg-inset)', border: '1px solid var(--border-secondary)', borderRadius: 5, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none' }}/>
              </div>
              <div>
                <label style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 5 }}>비고 (선택)</label>
                <input value={addNote} onChange={e => setAddNote(e.target.value)} placeholder="사유 메모"
                  style={{ width: '100%', padding: '8px 10px', boxSizing: 'border-box', background: 'var(--bg-inset)', border: '1px solid var(--border-secondary)', borderRadius: 5, color: 'var(--text-primary)', fontFamily: 'var(--font-main)', fontSize: 12, outline: 'none' }}/>
              </div>
            </div>
            {addErr && <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: '#f87171' }}>{addErr}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleAddManual} disabled={addBusy}
                style={{ padding: '7px 16px', borderRadius: 5, border: 'none', background: '#f87171', color: '#000', fontFamily: 'var(--font-main)', fontSize: 12, fontWeight: 600, cursor: addBusy ? 'not-allowed' : 'pointer', opacity: addBusy ? 0.6 : 1 }}>
                {addBusy ? '저장 중...' : '기록 추가'}
              </button>
              <button onClick={() => { setShowAdd(false); setAddErr('') }}
                style={{ padding: '7px 16px', borderRadius: 5, border: '1px solid var(--border-secondary)', background: 'transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-main)', fontSize: 12, cursor: 'pointer' }}>
                취소
              </button>
            </div>
          </div>
        )}

        {error && <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontFamily: 'var(--font-main)', fontSize: 13, color: '#f87171' }}>⚠ {error}</div>}

        {/* ── 회사 총수입 ── */}
        <div style={{ background: 'linear-gradient(135deg, rgba(77,182,172,0.10), rgba(77,182,172,0.02))', border: '1px solid rgba(77,182,172,0.3)', borderRadius: 12, padding: '22px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>회사 총수입 (회사에 귀속되는 모든 금액)</div>
              {loading || !rev
                ? <Shimmer w={200} h={32}/>
                : <div style={{ fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 700, color: '#4db6ac' }}>
                    {fmt(rev.companyTotal)} <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>USDT</span>
                  </div>}
              <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
                = 회사 기본수익(20%) + 낙전 &nbsp;=&nbsp; 총매출 − 회원 지급액
              </div>
            </div>
          </div>

          {/* 구성 분해 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1, marginTop: 20, background: 'var(--border-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, overflow: 'hidden' }}>
            {[
              { label: '총매출 (분윤)',        value: rev?.totalProfit, color: 'var(--text-primary)', note: `${rev?.reportCount ?? 0}개 정산` },
              { label: '회사 기본수익 (20%)',  value: rev?.companyBase, color: '#4db6ac', note: '회사 몫' },
              { label: '회원 지급액',          value: rev?.totalPaid,   color: '#a78bfa', note: '실제 지급' },
              { label: '미배분 낙전 (전체)',   value: rev?.forfeiture,  color: '#fbbf24', note: '회원 몫 80% − 실지급 (계산값)' },
            ].map(c => (
              <div key={c.label} style={{ background: 'var(--bg-surface)', padding: '14px 16px' }}>
                <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>{c.label}</div>
                {loading || !rev
                  ? <Shimmer h={18}/>
                  : <div style={{ fontFamily: 'var(--font-mono)', fontSize: 17, fontWeight: 700, color: c.color }}>{fmt(c.value ?? 0)}</div>}
                <div style={{ fontFamily: 'var(--font-main)', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3 }}>{c.note}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 낙전 상세 ── */}
        <div style={{ fontFamily: 'var(--font-main)', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 4 }}>
          사유별 낙전 명세 <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>· 정지·제명·수동·회사귀속 사유가 기록된 낙전 (위 '미배분 낙전(전체)'의 명세 일부)</span>
        </div>

        {/* KPI 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {/* 전체 합계 */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: '16px 20px' }}>
            <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>기록된 낙전 합계</div>
            {loading ? <Shimmer h={22}/> : (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: '#f87171' }}>
                {fmt(totalAll)} <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>USDT</span>
              </div>
            )}
            <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
              {loading ? <Shimmer w="50%" h={12}/> : `총 ${rows.length}건`}
            </div>
          </div>

          {/* 사유별 카드 */}
          {loading
            ? [1,2].map(i => (
                <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: '16px 20px' }}>
                  <Shimmer w="60%" h={11}/><div style={{marginTop:8}}/><Shimmer h={22}/><div style={{marginTop:4}}/><Shimmer w="40%" h={12}/>
                </div>
              ))
            : summary.map(s => {
                const c = REASON_COLOR[s.reason] ?? '#94a3b8'
                return (
                  <div key={s.reason} style={{ background: 'var(--bg-surface)', border: `1px solid ${c}22`, borderRadius: 8, padding: '16px 20px' }}>
                    <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: c, marginBottom: 8 }}>{REASON_LABEL[s.reason] ?? s.reason}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: c }}>
                      {fmt(s.total)} <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>USDT</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{s.count}건</div>
                  </div>
                )
              })
          }
        </div>

        {/* 상세 테이블 */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-primary)', fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
            낙전 내역 {!loading && `(${rows.length}건)`}
          </div>

          {/* 모바일 카드 */}
          {isMobile && (
            <div>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ padding: 14, borderBottom: '1px solid var(--border-primary)' }}><Shimmer/></div>)
                : rows.length === 0
                  ? <div style={{ padding: '40px 0', textAlign: 'center', fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)' }}>낙전 내역이 없습니다</div>
                  : rows.map((r, i) => {
                      const rc = REASON_COLOR[r.reason] ?? '#94a3b8'
                      const sc = r.profile_status === 'expelled' ? '#f87171' : r.profile_status === 'suspended' ? '#fbbf24' : '#34d399'
                      const statusLabel = r.profile_status === 'expelled' ? '제명' : r.profile_status === 'suspended' ? '정지' : '정상'
                      return (
                        <div key={r.id} style={{ padding: '13px 16px', borderTop: i === 0 ? 'none' : '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.profile_name}</div>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-blue)' }}>{r.profile_node_id}</span>
                            </div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: '#f87171', whiteSpace: 'nowrap' }}>{fmt(r.amount)}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'var(--font-main)', fontSize: 10, fontWeight: 600, color: sc, background: sc + '18', border: `1px solid ${sc}44`, padding: '2px 7px', borderRadius: 4 }}>{statusLabel}</span>
                            <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: rc }}>{REASON_LABEL[r.reason] ?? r.reason}</span>
                            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>{r.created_at.slice(0, 16).replace('T', ' ')}</span>
                          </div>
                        </div>
                      )
                    })
              }
            </div>
          )}

          {!isMobile &&
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-header)' }}>
                {['발생일시','회원 / 노드 ID','회원 상태','사유','금액 (USDT)','정산 보고서'].map((h, i) => (
                  <th key={i} style={{ padding: '10px 16px', textAlign: i >= 4 ? 'right' : 'left', fontSize: 11, fontFamily: 'var(--font-main)', color: 'var(--text-tertiary)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({length: 5}).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                      {Array.from({length: 6}).map((__, j) => <td key={j} style={{ padding: '12px 16px' }}><Shimmer/></td>)}
                    </tr>
                  ))
                : rows.length === 0
                  ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)' }}>
                        낙전 내역이 없습니다
                      </td>
                    </tr>
                  )
                  : rows.map((r, i) => {
                      const rc = REASON_COLOR[r.reason] ?? '#94a3b8'
                      const sc = r.profile_status === 'expelled' ? '#f87171' : r.profile_status === 'suspended' ? '#fbbf24' : '#34d399'
                      const statusLabel = r.profile_status === 'expelled' ? '제명' : r.profile_status === 'suspended' ? '정지' : '정상'
                      return (
                        <tr key={r.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border-primary)' : 'none' }}>
                          <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                            {r.created_at.slice(0, 16).replace('T', ' ')}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{r.profile_name}</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-blue)' }}>{r.profile_node_id}</div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, fontWeight: 600, color: sc, background: sc + '18', border: `1px solid ${sc}44`, padding: '2px 7px', borderRadius: 4 }}>{statusLabel}</span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: rc }}>{REASON_LABEL[r.reason] ?? r.reason}</span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: '#f87171' }}>
                            {fmt(r.amount)}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                            {r.report_id ? r.report_id.slice(0, 8) + '…' : <span style={{ color: 'var(--text-tertiary)' }}>수동</span>}
                          </td>
                        </tr>
                      )
                    })
              }
            </tbody>
          </table>}
        </div>
      </div>
    </>
  )
}
