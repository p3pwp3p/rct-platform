'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useIsMobile } from '@/lib/useIsMobile'

// ── 타입 ─────────────────────────────────────────────────────────────────────
type NodeRow = {
  id: string; node_id: string; name: string; rank: string; status: string
  sales: number; parent_id: string | null; leg_position: string | null
  mt5_account_id: string | null; trc20_address: string | null
  referral_code: string; owner_id: string | null; created_at: string
}
type AdminAccount = {
  id: string; email: string; name: string; phone: string | null
  trc20: string | null; is_admin: boolean; confirmed: boolean
  created_at: string; nodes: NodeRow[]; totalDownline: number
}
type Unregistered = {
  id: string; email: string; name: string; phone: string | null
  trc20: string | null; is_admin: boolean; confirmed: boolean; created_at: string
}

// ── 상수 ─────────────────────────────────────────────────────────────────────
const RANK_ORDER = ['R0','R1','R2','R3','R4','R5']
const RANK_COLOR: Record<string, string> = {
  R0: '#64748b', R1: '#34d399', R2: '#60a5fa',
  R3: '#fbbf24', R4: '#f97316', R5: '#a78bfa',
}
const STATUS_LABEL: Record<string, string> = { active:'정상', suspended:'정지', expelled:'제명' }
const STATUS_COLOR: Record<string, string> = { active:'#34d399', suspended:'#fbbf24', expelled:'#f87171' }

function fmtSales(n: number) {
  return n > 0 ? n.toLocaleString('ko-KR', { maximumFractionDigits: 0 }) : '—'
}
// 지갑주소 축약 (금융앱 표기: 앞 6 … 뒤 4)
function abbrAddr(a: string) {
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}
// ── 모바일: 미등록 회원 카드 ──────────────────────────────────────────────────
function UnregCard({ u }: { u: Unregistered }) {
  return (
    <div style={{ padding:'13px 15px', borderBottom:'1px solid var(--border-primary)', display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ fontFamily:'var(--font-main)', fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>{u.name}</span>
        {u.is_admin && <span style={{ fontFamily:'var(--font-main)', fontSize:9, fontWeight:600, color:'#ef4444', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', padding:'1px 5px', borderRadius:3 }}>관리자</span>}
        <span style={{ marginLeft:'auto', fontFamily:'var(--font-main)', fontSize:11, fontWeight:600, color: u.confirmed ? '#34d399' : '#fbbf24' }}>{u.confirmed ? '인증완료' : '인증대기'}</span>
      </div>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.email}</div>
      <div style={{ display:'flex', gap:16, fontSize:11 }}>
        <span style={{ fontFamily:'var(--font-mono)', color: u.phone ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>{u.phone ?? '전화 미등록'}</span>
        <span style={{ fontFamily:'var(--font-mono)', color: u.trc20 ? '#34d399' : 'var(--text-tertiary)' }}>{u.trc20 ? abbrAddr(u.trc20) : '지갑 미등록'}</span>
        <span style={{ marginLeft:'auto', fontFamily:'var(--font-mono)', color:'var(--text-tertiary)' }}>{u.created_at.slice(0,10)}</span>
      </div>
    </div>
  )
}

// ── 모바일: 보유 노드 카드 ────────────────────────────────────────────────────
function NodeCardMobile({ node, onEdit }: { node: NodeRow; onEdit: () => void }) {
  const rc = RANK_COLOR[node.rank] ?? '#64748b'
  const sc = STATUS_COLOR[node.status ?? 'active'] ?? '#34d399'
  const isMain = !node.owner_id || node.owner_id === node.id
  const leg = node.leg_position === 'LEFT' ? 'LEFT' : node.leg_position === 'RIGHT' ? 'RIGHT' : 'ROOT'
  return (
    <div style={{ background:'var(--bg-surface)', border:`1px solid ${isMain ? '#60a5fa44' : 'var(--border-primary)'}`, borderLeft:`3px solid ${sc}`, borderRadius:8, padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>
      {/* 헤더: 이름/노드ID + 직급·상태 */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
        <div style={{ minWidth:0, flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontFamily:'var(--font-main)', fontSize:13, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{node.name}</span>
            {isMain && <span style={{ fontFamily:'var(--font-main)', fontSize:9, fontWeight:600, color:'#60a5fa', background:'rgba(96,165,250,0.12)', border:'1px solid rgba(96,165,250,0.3)', padding:'1px 5px', borderRadius:3, flexShrink:0 }}>메인</span>}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:3 }}>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'#60a5fa' }}>{node.node_id}</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-tertiary)', letterSpacing:'0.04em' }}>{leg}</span>
          </div>
        </div>
        <div style={{ display:'flex', gap:5, flexShrink:0 }}>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:10, fontWeight:700, color:rc, background:rc+'18', border:`1px solid ${rc}44`, padding:'2px 7px', borderRadius:4 }}>{node.rank}</span>
          <span style={{ fontFamily:'var(--font-main)', fontSize:10, fontWeight:600, color:sc, background:sc+'15', border:`1px solid ${sc}44`, padding:'2px 7px', borderRadius:4 }}>{STATUS_LABEL[node.status ?? 'active']}</span>
        </div>
      </div>
      {/* 키-값 그리드 */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 12px', borderTop:'1px solid var(--border-primary)', paddingTop:10 }}>
        <Field label="추천코드" value={node.referral_code || '—'} color="#a78bfa" />
        <Field label="Vantage C.T" value={node.mt5_account_id ?? '—'} color={node.mt5_account_id ? '#60a5fa' : 'var(--text-tertiary)'} />
        <Field label="매출" value={fmtSales(node.sales)} color="var(--text-primary)" />
      </div>
      <button onClick={onEdit}
        style={{ alignSelf:'flex-end', padding:'7px 16px', borderRadius:6, border:`1px solid ${rc}55`, background:rc+'12', color:rc, fontFamily:'var(--font-main)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
        편집
      </button>
    </div>
  )
}
function Field({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ minWidth:0 }}>
      <div style={{ fontFamily:'var(--font-main)', fontSize:9, color:'var(--text-tertiary)', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:12, fontWeight:600, color, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{value}</div>
    </div>
  )
}

// ── 모바일: 계정 카드 ─────────────────────────────────────────────────────────
function AccountCard({ acc, isExp, onToggle, onEdit }: {
  acc: AdminAccount; isExp: boolean; onToggle: () => void; onEdit: (n: NodeRow) => void
}) {
  return (
    <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border-primary)', borderRadius:10, overflow:'hidden' }}>
      <button onClick={onToggle}
        style={{ width:'100%', textAlign:'left', background:'none', border:'none', cursor:'pointer', padding:'14px 16px', display:'flex', flexDirection:'column', gap:11 }}>
        {/* 이름 + 배지 + 펼침 */}
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <span style={{ fontFamily:'var(--font-main)', fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>{acc.name}</span>
          {acc.is_admin && <span style={{ fontFamily:'var(--font-main)', fontSize:9, fontWeight:600, color:'#ef4444', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', padding:'1px 5px', borderRadius:3 }}>관리자</span>}
          {!acc.confirmed && <span style={{ fontFamily:'var(--font-main)', fontSize:9, fontWeight:600, color:'#fbbf24', background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.3)', padding:'1px 5px', borderRadius:3 }}>미인증</span>}
          <AccountStatusBadges nodes={acc.nodes} />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" style={{ marginLeft:'auto', transition:'transform 0.2s', transform: isExp ? 'rotate(90deg)' : 'none', flexShrink:0 }}><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        {/* 이메일 */}
        <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{acc.email}</div>
        {/* 통계 스트립 */}
        <div style={{ display:'flex', border:'1px solid var(--border-primary)', borderRadius:8, overflow:'hidden', background:'var(--bg-inset)' }}>
          <StatCell label="보유 노드" value={String(acc.nodes.length)} accent={acc.nodes.length > 1 ? '#a78bfa' : undefined} />
          <StatCell label="전체 하위" value={String(acc.totalDownline)} divider />
          <StatCell label="가입일" value={acc.created_at.slice(0,10)} divider small />
        </div>
        {/* 지갑 */}
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={acc.trc20 ? '#34d399' : 'var(--text-tertiary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h.01M2 10h20"/></svg>
          <span style={{ fontFamily:'var(--font-main)', fontSize:10, color:'var(--text-tertiary)' }}>TRC-20</span>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color: acc.trc20 ? '#34d399' : 'var(--text-tertiary)' }}>{acc.trc20 ? abbrAddr(acc.trc20) : '미등록'}</span>
        </div>
      </button>
      {/* 펼침: 보유 노드 */}
      {isExp && (
        <div style={{ borderTop:'1px solid var(--border-primary)', background:'var(--bg-header)', padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ fontFamily:'var(--font-main)', fontSize:10, fontWeight:600, color:'var(--text-tertiary)', textTransform:'uppercase', letterSpacing:'0.06em' }}>보유 노드 ({acc.nodes.length})</div>
          {acc.nodes.map(n => <NodeCardMobile key={n.id} node={n} onEdit={() => onEdit(n)} />)}
        </div>
      )}
    </div>
  )
}
function StatCell({ label, value, accent, divider, small }: {
  label: string; value: string; accent?: string; divider?: boolean; small?: boolean
}) {
  return (
    <div style={{ flex:1, padding:'9px 10px', borderLeft: divider ? '1px solid var(--border-primary)' : 'none' }}>
      <div style={{ fontFamily:'var(--font-main)', fontSize:9, color:'var(--text-tertiary)', marginBottom:3, whiteSpace:'nowrap' }}>{label}</div>
      <div style={{ fontFamily:'var(--font-mono)', fontSize: small ? 11 : 16, fontWeight:700, color: accent ?? 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}
function Shimmer() {
  return <div style={{ height:14, borderRadius:4, width:'70%', background:'linear-gradient(90deg,var(--bg-inset) 25%,rgba(148,163,184,0.06) 50%,var(--bg-inset) 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.4s infinite' }}/>
}
// 계정 하위 노드의 제명/정지 상태를 한눈에 보이는 배지 (관리자 목록용)
function AccountStatusBadges({ nodes }: { nodes: NodeRow[] }) {
  const exp  = nodes.filter(n => n.status === 'expelled').length
  const susp = nodes.filter(n => n.status === 'suspended').length
  if (!exp && !susp) return null
  const chip = (label: string, count: number, color: string) => (
    <span style={{ fontFamily:'var(--font-main)', fontSize:9, fontWeight:700, color, background:color+'1a', border:`1px solid ${color}55`, padding:'1px 6px', borderRadius:3, whiteSpace:'nowrap' }}>
      {label}{count > 1 ? ` ${count}` : ''}
    </span>
  )
  return <>{exp > 0 && chip('제명', exp, '#f87171')}{susp > 0 && chip('정지', susp, '#fbbf24')}</>
}

// ── 노드 편집 모달 ────────────────────────────────────────────────────────────
function EditModal({ node, onClose, onSaved }: {
  node: NodeRow; onClose: () => void; onSaved: () => void
}) {
  const [rank,   setRank]   = useState(node.rank)
  const [mt5,    setMt5]    = useState(node.mt5_account_id ?? '')
  const [status, setStatus] = useState(node.status ?? 'active')
  const [reason, setReason] = useState('')
  const [busy,   setBusy]   = useState(false)
  const [err,    setErr]    = useState('')
  const [ok,     setOk]     = useState(false)
  const [delConfirm, setDelConfirm] = useState(false)
  const [delBusy,    setDelBusy]    = useState(false)

  type StatusHistRow = { id:string; old_status:string; new_status:string; reason:string|null; changed_at:string }
  const [history,     setHistory]     = useState<StatusHistRow[]|null>(null)
  const [histLoading, setHistLoading] = useState(false)
  const [histOpen,    setHistOpen]    = useState(false)
  const origStatus = node.status ?? 'active'
  const statusChanged = status !== origStatus

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key==='Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  async function loadHistory() {
    if (history !== null) { setHistOpen(o => !o); return }
    setHistLoading(true)
    try {
      const { data, error } = await supabase
        .from('status_history')
        .select('id, old_status, new_status, reason, changed_at')
        .eq('profile_id', node.id)
        .order('changed_at', { ascending: false })
        .limit(50)
      if (error) throw error
      setHistory(data ?? [])
      setHistOpen(true)
    } finally { setHistLoading(false) }
  }

  async function handleSave() {
    if (statusChanged && status !== 'active' && !reason.trim()) { setErr('정지/제명 사유를 입력해주세요'); return }
    setBusy(true); setErr('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const body: Record<string,unknown> = { id: node.id, rank, mt5_account_id: mt5, status }
      if (statusChanged) body.status_reason = reason.trim()
      const res = await fetch('/api/admin/member', {
        method: 'PATCH',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setOk(true)
      setTimeout(() => { onSaved(); onClose() }, 800)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '오류')
    } finally { setBusy(false) }
  }

  async function handleDelete() {
    setDelBusy(true); setErr('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/delete-node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId: node.id, accessToken: session?.access_token ?? '' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? '삭제 실패')
      onSaved(); onClose()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '삭제 오류')
      setDelConfirm(false)
    } finally { setDelBusy(false) }
  }

  const rc = RANK_COLOR[rank]
  const sc = STATUS_COLOR[status]

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(3px)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ width:'min(460px, calc(100vw - 24px))', background:'var(--bg-surface)', border:'1px solid var(--border-primary)', borderRadius:12, overflow:'hidden', boxShadow:'0 24px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border-primary)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontFamily:'var(--font-main)', fontSize:15, fontWeight:700, color:'var(--text-primary)', display:'flex', alignItems:'center', gap:8 }}>
              {node.name}
              <span style={{ fontFamily:'var(--font-mono)', fontSize:10, fontWeight:700, color:STATUS_COLOR[origStatus], background:STATUS_COLOR[origStatus]+'18', border:`1px solid ${STATUS_COLOR[origStatus]}44`, padding:'2px 7px', borderRadius:4 }}>{STATUS_LABEL[origStatus]}</span>
            </div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'#60a5fa', marginTop:2 }}>{node.node_id}</div>
          </div>
          <button onClick={onClose} style={{ width:28, height:28, border:'none', background:'rgba(255,255,255,0.04)', borderRadius:5, cursor:'pointer', color:'var(--text-tertiary)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:16, maxHeight:'70vh', overflowY:'auto' }}>
          {/* 직급 */}
          <div>
            <label style={{ fontFamily:'var(--font-main)', fontSize:11, color:'var(--text-tertiary)', display:'block', marginBottom:8 }}>직급</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {RANK_ORDER.map(r => {
                const c = RANK_COLOR[r]; const active = rank === r
                return (
                  <button key={r} onClick={() => setRank(r)}
                    style={{ padding:'6px 14px', borderRadius:5, border:`1px solid ${active ? c : 'var(--border-secondary)'}`, background: active ? c+'18' : 'transparent', color: active ? c : 'var(--text-tertiary)', fontFamily:'var(--font-mono)', fontSize:12, fontWeight:700, cursor:'pointer', transition:'all 0.15s' }}>
                    {r}
                  </button>
                )
              })}
            </div>
          </div>
          {/* MT5 */}
          <div>
            <label style={{ fontFamily:'var(--font-main)', fontSize:11, color:'var(--text-tertiary)', display:'block', marginBottom:6 }}>Vantage C.T 계정 번호</label>
            <input value={mt5} onChange={e => setMt5(e.target.value.replace(/\D/g,''))} maxLength={12}
              placeholder="Vantage C.T 계정 번호"
              style={{ width:'100%', padding:'9px 12px', boxSizing:'border-box', background:'var(--bg-inset)', border:'1px solid var(--border-secondary)', borderRadius:6, color:'var(--text-primary)', fontFamily:'var(--font-mono)', fontSize:13, outline:'none' }}
              onFocus={e => (e.currentTarget.style.borderColor='#60a5fa')}
              onBlur={e => (e.currentTarget.style.borderColor='var(--border-secondary)')}/>
          </div>
          {/* 회원 상태 */}
          <div style={{ borderTop:'1px solid var(--border-primary)', paddingTop:16 }}>
            <label style={{ fontFamily:'var(--font-main)', fontSize:11, color:'var(--text-tertiary)', display:'block', marginBottom:8 }}>
              회원 상태
              <span style={{ marginLeft:6, fontFamily:'var(--font-main)', fontSize:10, color:'var(--text-tertiary)' }}>· 정지/제명 시 해당 노드 수당은 낙전 처리됩니다</span>
            </label>
            <div style={{ display:'flex', gap:6 }}>
              {(['active','suspended','expelled'] as const).map(s => {
                const c = STATUS_COLOR[s]; const active = status === s
                return (
                  <button key={s} onClick={() => setStatus(s)}
                    style={{ flex:1, padding:'8px 0', borderRadius:5, border:`1px solid ${active ? c : 'var(--border-secondary)'}`, background: active ? c+'18' : 'transparent', color: active ? c : 'var(--text-tertiary)', fontFamily:'var(--font-main)', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.15s' }}>
                    {STATUS_LABEL[s]}
                  </button>
                )
              })}
            </div>
            {statusChanged && status !== 'active' && (
              <div style={{ marginTop:10 }}>
                <label style={{ fontFamily:'var(--font-main)', fontSize:11, color:sc, display:'block', marginBottom:6 }}>{STATUS_LABEL[status]} 사유 <span style={{ color:'#f87171' }}>*</span></label>
                <textarea value={reason} onChange={e => { setReason(e.target.value); setErr('') }}
                  placeholder={`${STATUS_LABEL[status]} 사유를 입력해주세요`} rows={2}
                  style={{ width:'100%', padding:'9px 12px', boxSizing:'border-box', background:'var(--bg-inset)', border:`1px solid ${sc}66`, borderRadius:6, color:'var(--text-primary)', fontFamily:'var(--font-main)', fontSize:13, outline:'none', resize:'vertical', lineHeight:1.5 }}/>
              </div>
            )}
            {statusChanged && status === 'active' && (
              <div style={{ marginTop:8, fontFamily:'var(--font-main)', fontSize:11, color:'#34d399' }}>↩ 정상 상태로 복구합니다</div>
            )}
          </div>
          {/* 상태 변경 이력 */}
          <div style={{ borderTop:'1px solid var(--border-primary)', paddingTop:12 }}>
            <button onClick={loadHistory} style={{ display:'flex', alignItems:'center', gap:6, background:'transparent', border:'none', cursor:'pointer', padding:0 }}>
              <span style={{ fontFamily:'var(--font-main)', fontSize:11, fontWeight:600, color:'var(--text-tertiary)' }}>상태 변경 이력</span>
              {histLoading
                ? <span style={{ fontFamily:'var(--font-main)', fontSize:10, color:'var(--text-tertiary)' }}>로딩...</span>
                : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5" style={{ transition:'transform 0.2s', transform: histOpen ? 'rotate(180deg)' : 'none' }}><polyline points="6 9 12 15 18 9"/></svg>
              }
            </button>
            {histOpen && history !== null && (
              <div style={{ marginTop:8 }}>
                {history.length === 0
                  ? <div style={{ fontFamily:'var(--font-main)', fontSize:11, color:'var(--text-tertiary)', padding:'8px 0' }}>이력 없음</div>
                  : <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:160, overflowY:'auto' }}>
                      {history.map(h => {
                        const OC = h.old_status==='active' ? '#34d399' : h.old_status==='suspended' ? '#fbbf24' : '#f87171'
                        const NC = h.new_status==='active' ? '#34d399' : h.new_status==='suspended' ? '#fbbf24' : '#f87171'
                        const OL = h.old_status==='active' ? '정상' : h.old_status==='suspended' ? '정지' : '제명'
                        const NL = h.new_status==='active' ? '정상' : h.new_status==='suspended' ? '정지' : '제명'
                        return (
                          <div key={h.id} style={{ background:'var(--bg-inset)', border:'1px solid var(--border-primary)', borderRadius:6, padding:'8px 12px', display:'grid', gridTemplateColumns:'auto 1fr auto', gap:10, alignItems:'center' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                              <span style={{ fontFamily:'var(--font-main)', fontSize:11, fontWeight:600, color:OC }}>{OL}</span>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                              <span style={{ fontFamily:'var(--font-main)', fontSize:11, fontWeight:700, color:NC }}>{NL}</span>
                            </div>
                            <span style={{ fontFamily:'var(--font-main)', fontSize:11, color:'var(--text-tertiary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.reason ?? '—'}</span>
                            <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-tertiary)', whiteSpace:'nowrap' }}>{h.changed_at.slice(0,10)}</span>
                          </div>
                        )
                      })}
                    </div>
                }
              </div>
            )}
          </div>
          {err && <div style={{ fontFamily:'var(--font-main)', fontSize:12, color:'#f87171', padding:'8px 12px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:6 }}>{err}</div>}
          {ok  && <div style={{ fontFamily:'var(--font-main)', fontSize:12, color:'#34d399' }}>✓ 저장됐습니다</div>}

          {/* 위험 구역 — 노드 삭제 */}
          <div style={{ borderTop:'1px solid var(--border-primary)', paddingTop:14, marginTop:2 }}>
            {!delConfirm ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
                <span style={{ fontFamily:'var(--font-main)', fontSize:11, color:'var(--text-tertiary)', lineHeight:1.5 }}>노드를 삭제하면 하위 노드가 위로 붙습니다(바이너리 자식 2개·수당 이력 있으면 불가).</span>
                <button onClick={() => { setErr(''); setDelConfirm(true) }} style={{ padding:'6px 12px', borderRadius:6, border:'1px solid rgba(239,68,68,0.35)', background:'transparent', color:'#f87171', fontFamily:'var(--font-main)', fontSize:12, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>노드 삭제</button>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:6 }}>
                <span style={{ flex:1, minWidth:0, fontFamily:'var(--font-main)', fontSize:12, color:'#f87171', lineHeight:1.5 }}><strong>{node.node_id}</strong> 노드를 삭제합니다. 되돌릴 수 없습니다.</span>
                <button disabled={delBusy} onClick={handleDelete} style={{ padding:'6px 14px', borderRadius:6, border:'none', background:'#ef4444', color:'#fff', fontFamily:'var(--font-main)', fontSize:12, fontWeight:700, cursor: delBusy ? 'not-allowed':'pointer', opacity: delBusy?0.6:1, flexShrink:0 }}>{delBusy ? '삭제 중…' : '삭제 확정'}</button>
                <button onClick={() => setDelConfirm(false)} style={{ padding:'6px 12px', borderRadius:6, border:'1px solid var(--border-secondary)', background:'transparent', color:'var(--text-secondary)', fontFamily:'var(--font-main)', fontSize:12, cursor:'pointer', flexShrink:0 }}>취소</button>
              </div>
            )}
          </div>

          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 }}>
            <button onClick={onClose} style={{ padding:'9px 18px', borderRadius:6, border:'1px solid var(--border-secondary)', background:'transparent', color:'var(--text-secondary)', fontFamily:'var(--font-main)', fontSize:13, cursor:'pointer' }}>취소</button>
            <button onClick={handleSave} disabled={busy||ok}
              style={{ padding:'9px 18px', borderRadius:6, border:'none', background: ok ? '#34d399' : status!=='active' ? STATUS_COLOR[status] : rc, color:'#000', fontFamily:'var(--font-main)', fontSize:13, fontWeight:600, cursor: busy||ok ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1, transition:'all 0.15s' }}>
              {ok ? '✓ 저장됨' : busy ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function MembersPage() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [search,   setSearch]   = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing,  setEditing]  = useState<NodeRow | null>(null)
  const [recalcBusy, setRecalcBusy] = useState(false)
  const [recalcMsg,  setRecalcMsg]  = useState('')

  const [unreg, setUnreg] = useState<Unregistered[]>([])
  const [unregOpen, setUnregOpen] = useState(true)
  const isMobile = useIsMobile()

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? ''
  }, [])

  async function loadAccounts() {
    setLoading(true); setError('')
    try {
      const token = await getToken()
      const res  = await fetch('/api/admin/accounts', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setAccounts(json.accounts)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '로딩 오류')
    } finally { setLoading(false) }
  }

  async function loadUnregistered() {
    try {
      const token = await getToken()
      const res  = await fetch('/api/admin/unregistered-members', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (res.ok) setUnreg(json.members)
    } catch { /* noop */ }
  }

  function load() { loadAccounts(); loadUnregistered() }
  useEffect(() => { load() }, [])

  async function handleRecalc() {
    setRecalcBusy(true); setRecalcMsg('')
    try {
      const token = await getToken()
      const res  = await fetch('/api/rank-check', { method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body: JSON.stringify({ all:true }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setRecalcMsg(`직급 재계산 완료 — ${json.upgraded.length}건 승급`)
      load()
    } catch (e: unknown) {
      setRecalcMsg(e instanceof Error ? e.message : '오류')
    } finally {
      setRecalcBusy(false)
      setTimeout(() => setRecalcMsg(''), 4000)
    }
  }

  const filtered = accounts.filter(a =>
    !search ||
    a.name.includes(search) ||
    a.email.toLowerCase().includes(search.toLowerCase()) ||
    a.nodes.some(n =>
      n.node_id.includes(search) ||
      n.referral_code.toUpperCase().includes(search.toUpperCase()) ||
      n.name.includes(search)
    )
  )

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes spin { to { transform: rotate(360deg) } }
        .acc-row { transition: background 0.12s; cursor: pointer; }
        .acc-row:hover { background: rgba(148,163,184,0.03); }
        .edit-btn { opacity:0; transition: opacity 0.15s; }
        .node-card:hover .edit-btn { opacity:1; }
      `}</style>

      {editing && <EditModal node={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}

      <div style={{ padding: isMobile ? 16 : 28, display:'flex', flexDirection:'column', gap:20, maxWidth:1600, margin:'0 auto', width:'100%', boxSizing:'border-box' }}>

        {/* 헤더 */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12 }}>
          <div>
            <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)', marginBottom:4, fontFamily:'var(--font-main)' }}>회원 관리</h1>
            <p style={{ fontSize:12, color:'var(--text-tertiary)', fontFamily:'var(--font-main)' }}>
              {loading ? '로딩 중...' : `전체 ${accounts.length}명 · 노드 ${accounts.reduce((s,a)=>s+a.nodes.length,0)}개`}
            </p>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', width: isMobile ? '100%' : 'auto' }}>
            {recalcMsg && <span style={{ fontFamily:'var(--font-main)', fontSize:12, color: recalcMsg.includes('완료') ? '#34d399' : '#f87171' }}>{recalcMsg}</span>}
            <button onClick={handleRecalc} disabled={recalcBusy}
              style={{ padding:'8px 14px', borderRadius:6, border:'1px solid var(--border-secondary)', background:'transparent', color:'var(--text-secondary)', fontFamily:'var(--font-main)', fontSize:12, cursor: recalcBusy ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', gap:6, opacity: recalcBusy ? 0.5 : 1 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: recalcBusy ? 'spin 1s linear infinite' : 'none' }}>
                <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              {recalcBusy ? '계산 중...' : '직급 재계산'}
            </button>
            <div style={{ position:'relative', flex: isMobile ? 1 : 'none', minWidth: isMobile ? 0 : undefined }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름, 이메일, 노드ID, 추천코드"
                style={{ background:'var(--bg-surface)', border:'1px solid var(--border-secondary)', color:'var(--text-primary)', padding:'8px 14px 8px 32px', borderRadius:4, fontSize:12, fontFamily:'var(--font-main)', outline:'none', width: isMobile ? '100%' : 240, boxSizing:'border-box' }}/>
            </div>
          </div>
        </div>

        {error && <div style={{ padding:'12px 16px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:6, fontFamily:'var(--font-main)', fontSize:13, color:'#f87171' }}>⚠ {error}</div>}

        {/* 미등록 회원 */}
        {unreg.length > 0 && (
          <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border-primary)', borderRadius:8, overflow:'hidden' }}>
            <button onClick={() => setUnregOpen(o => !o)}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'rgba(251,191,36,0.06)', border:'none', borderBottom: unregOpen ? '1px solid var(--border-primary)' : 'none', cursor:'pointer', textAlign:'left' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" style={{ transition:'transform 0.2s', transform: unregOpen ? 'rotate(90deg)' : 'none' }}><polyline points="9 18 15 12 9 6"/></svg>
              <span style={{ fontFamily:'var(--font-main)', fontSize:13, fontWeight:600, color:'#fbbf24' }}>미등록 회원 (가입했지만 노드 없음)</span>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:12, fontWeight:700, color:'#fbbf24', background:'rgba(251,191,36,0.12)', border:'1px solid rgba(251,191,36,0.35)', padding:'1px 8px', borderRadius:10 }}>{unreg.length}</span>
            </button>
            {unregOpen && isMobile && (
              <div>
                {unreg.map(u => <UnregCard key={u.id} u={u} />)}
              </div>
            )}
            {unregOpen && !isMobile && (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', minWidth:700, borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid var(--border-primary)', background:'var(--bg-header)' }}>
                      {['이름','이메일','전화번호','TRC-20 지갑','인증','가입일'].map((h,i) => (
                        <th key={i} style={{ padding:'9px 16px', textAlign:'left', fontSize:11, fontFamily:'var(--font-main)', color:'var(--text-tertiary)', fontWeight:600, whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {unreg.map((u, i) => (
                      <tr key={u.id} style={{ borderBottom: i < unreg.length-1 ? '1px solid var(--border-primary)' : 'none' }}>
                        <td style={{ padding:'10px 16px', fontFamily:'var(--font-main)', fontSize:13, color:'var(--text-primary)', whiteSpace:'nowrap' }}>
                          {u.name}
                          {u.is_admin && <span style={{ marginLeft:6, fontFamily:'var(--font-main)', fontSize:9, fontWeight:600, color:'#ef4444', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', padding:'1px 5px', borderRadius:3 }}>관리자</span>}
                        </td>
                        <td style={{ padding:'10px 16px', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text-secondary)' }}>{u.email}</td>
                        <td style={{ padding:'10px 16px', fontFamily:'var(--font-mono)', fontSize:12, color: u.phone ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>{u.phone ?? '—'}</td>
                        <td style={{ padding:'10px 16px', fontFamily:'var(--font-mono)', fontSize:11, color: u.trc20 ? '#34d399' : 'var(--text-tertiary)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.trc20 ?? '—'}</td>
                        <td style={{ padding:'10px 16px' }}><span style={{ fontFamily:'var(--font-main)', fontSize:11, fontWeight:600, color: u.confirmed ? '#34d399' : '#fbbf24' }}>{u.confirmed ? '완료' : '대기'}</span></td>
                        <td style={{ padding:'10px 16px', fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-tertiary)', whiteSpace:'nowrap' }}>{u.created_at.slice(0,10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 계정 목록 — 모바일 카드 */}
        {isMobile && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {loading
              ? Array.from({length:4}).map((_,i) => (
                  <div key={i} style={{ background:'var(--bg-surface)', border:'1px solid var(--border-primary)', borderRadius:10, padding:16, display:'flex', flexDirection:'column', gap:10 }}>
                    <Shimmer/><Shimmer/>
                  </div>
                ))
              : filtered.length === 0
                ? <div style={{ padding:'40px 0', textAlign:'center', fontFamily:'var(--font-main)', fontSize:13, color:'var(--text-tertiary)' }}>검색 결과가 없습니다</div>
                : filtered.map(acc => (
                    <AccountCard key={acc.id} acc={acc} isExp={expanded === acc.id}
                      onToggle={() => setExpanded(expanded === acc.id ? null : acc.id)}
                      onEdit={setEditing} />
                  ))
            }
          </div>
        )}

        {/* 계정 테이블 — 데스크톱 */}
        {!isMobile && (
        <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border-primary)', borderRadius:8, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed' }}>
            <colgroup>
              <col style={{ width:40 }}/>
              <col style={{ width:'22%' }}/>
              <col style={{ width:'22%' }}/>
              <col style={{ width:'24%' }}/>
              <col style={{ width:80 }}/>
              <col style={{ width:100 }}/>
              <col style={{ width:70 }}/>
            </colgroup>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border-primary)', background:'var(--bg-header)' }}>
                {[
                  { label:'',            align:'left'   },
                  { label:'이름',         align:'left'   },
                  { label:'이메일',        align:'left'   },
                  { label:'TRC-20 지갑주소', align:'left'  },
                  { label:'보유 노드',     align:'center' },
                  { label:'가입일',        align:'left'   },
                  { label:'전체 하위',     align:'center' },
                ].map((h,i) => (
                  <th key={i} style={{ padding:'10px 16px', textAlign: h.align as 'left'|'center', fontSize:11, fontFamily:'var(--font-main)', color:'var(--text-tertiary)', fontWeight:600, whiteSpace:'nowrap' }}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({length:5}).map((_,i) => (
                    <tr key={i} style={{ borderBottom:'1px solid var(--border-primary)' }}>
                      {Array.from({length:7}).map((__,j) => <td key={j} style={{ padding:'14px 16px' }}><Shimmer/></td>)}
                    </tr>
                  ))
                : filtered.map((acc, ai) => {
                    const isExp = expanded === acc.id
                    return (
                      <React.Fragment key={acc.id}>
                        {/* 계정 행 */}
                        <tr className="acc-row"
                          onClick={() => setExpanded(isExp ? null : acc.id)}
                          style={{ borderBottom: isExp ? 'none' : ai < filtered.length-1 ? '1px solid var(--border-primary)' : 'none' }}>
                          <td style={{ padding:'12px 8px 12px 16px' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" style={{ transition:'transform 0.2s', transform: isExp ? 'rotate(90deg)' : 'rotate(0deg)' }}><polyline points="9 18 15 12 9 6"/></svg>
                          </td>
                          <td style={{ padding:'12px 16px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <span style={{ fontFamily:'var(--font-main)', fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{acc.name}</span>
                              {acc.is_admin && <span style={{ fontFamily:'var(--font-main)', fontSize:9, fontWeight:600, color:'#ef4444', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', padding:'1px 5px', borderRadius:3 }}>관리자</span>}
                              {!acc.confirmed && <span style={{ fontFamily:'var(--font-main)', fontSize:9, fontWeight:600, color:'#fbbf24', background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.3)', padding:'1px 5px', borderRadius:3 }}>미인증</span>}
                              <AccountStatusBadges nodes={acc.nodes} />
                            </div>
                            {acc.phone && <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-tertiary)', marginTop:2 }}>{acc.phone}</div>}
                          </td>
                          <td style={{ padding:'12px 16px', fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{acc.email}</td>
                          <td style={{ padding:'12px 16px', overflow:'hidden' }}>
                            {acc.trc20
                              ? <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'#34d399', display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{acc.trc20}</span>
                              : <span style={{ fontFamily:'var(--font-main)', fontSize:11, color:'var(--text-tertiary)' }}>미등록</span>}
                          </td>
                          <td style={{ padding:'12px 16px', textAlign:'center', fontFamily:'var(--font-mono)', fontSize:14, fontWeight:700, color: acc.nodes.length > 1 ? '#a78bfa' : 'var(--text-secondary)' }}>
                            {acc.nodes.length}
                          </td>
                          <td style={{ padding:'12px 16px', fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-tertiary)', whiteSpace:'nowrap' }}>{acc.created_at.slice(0,10)}</td>
                          <td style={{ padding:'12px 16px', textAlign:'center', fontFamily:'var(--font-mono)', fontSize:12, color: acc.totalDownline>0 ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>{acc.totalDownline}</td>
                        </tr>
                        {/* 노드 펼침 */}
                        {isExp && (
                          <tr style={{ borderBottom: ai < filtered.length-1 ? '1px solid var(--border-primary)' : 'none' }}>
                            <td colSpan={7} style={{ padding:'0 16px 16px 56px', background:'var(--bg-header)' }}>
                              <div style={{ paddingTop:12 }}>
                                <div style={{ fontSize:10, fontFamily:'var(--font-main)', fontWeight:600, color:'var(--text-tertiary)', marginBottom:8 }}>
                                  보유 노드 ({acc.nodes.length})
                                </div>
                                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                                  {acc.nodes.map(node => {
                                    const rc  = RANK_COLOR[node.rank] ?? '#64748b'
                                    const sc  = STATUS_COLOR[node.status ?? 'active'] ?? '#34d399'
                                    const isMain = !node.owner_id || node.owner_id === node.id
                                    return (
                                      <div key={node.id} className="node-card"
                                        style={{ display:'grid', gridTemplateColumns:'80px 1fr 110px 90px 52px 80px 52px 80px', gap:'0 12px', padding:'9px 14px', background:'var(--bg-surface)', border:`1px solid ${isMain ? '#60a5fa44' : 'var(--border-primary)'}`, borderRadius:5, alignItems:'center' }}>
                                        {/* 레그 */}
                                        <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'#60a5fa' }}>
                                          {node.leg_position === 'LEFT' ? '← LEFT' : node.leg_position === 'RIGHT' ? 'RIGHT →' : '— ROOT'}
                                        </div>
                                        {/* 이름 + 노드ID */}
                                        <div style={{ minWidth:0 }}>
                                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                            <span style={{ fontFamily:'var(--font-main)', fontSize:12, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{node.name}</span>
                                            {isMain && <span style={{ fontFamily:'var(--font-main)', fontSize:9, fontWeight:600, color:'#60a5fa', background:'rgba(96,165,250,0.12)', border:'1px solid rgba(96,165,250,0.3)', padding:'1px 5px', borderRadius:3, flexShrink:0 }}>메인</span>}
                                          </div>
                                          <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'#60a5fa' }}>{node.node_id}</div>
                                        </div>
                                        {/* 추천코드 */}
                                        <div style={{ minWidth:0 }}>
                                          <div style={{ fontFamily:'var(--font-main)', fontSize:8, color:'var(--text-tertiary)', marginBottom:2 }}>추천코드</div>
                                          <span style={{ fontFamily:'var(--font-mono)', fontSize:11, fontWeight:600, letterSpacing:'0.04em', color:'#a78bfa' }}>{node.referral_code || '—'}</span>
                                        </div>
                                        {/* MT5 */}
                                        <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color: node.mt5_account_id ? '#60a5fa' : 'var(--text-tertiary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                          {node.mt5_account_id ?? '—'}
                                        </div>
                                        {/* 직급 */}
                                        <span style={{ fontFamily:'var(--font-mono)', fontSize:10, fontWeight:700, color:rc, background:rc+'18', border:`1px solid ${rc}44`, padding:'2px 6px', borderRadius:3, whiteSpace:'nowrap', justifySelf:'start' }}>{node.rank}</span>
                                        {/* 상태 */}
                                        <span style={{ fontFamily:'var(--font-main)', fontSize:10, fontWeight:600, color:sc, background:sc+'15', border:`1px solid ${sc}44`, padding:'2px 6px', borderRadius:3, whiteSpace:'nowrap', justifySelf:'start' }}>{STATUS_LABEL[node.status ?? 'active']}</span>
                                        {/* 매출 */}
                                        <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-secondary)', textAlign:'right' }}>{fmtSales(node.sales)}</div>
                                        {/* 편집 */}
                                        <button className="edit-btn" onClick={e => { e.stopPropagation(); setEditing(node) }}
                                          style={{ padding:'4px 10px', borderRadius:4, border:'1px solid var(--border-secondary)', background:'transparent', color:'var(--text-secondary)', fontFamily:'var(--font-main)', fontSize:11, cursor:'pointer', justifySelf:'end' }}>
                                          편집
                                        </button>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })
              }
            </tbody>
          </table>
        </div>
        )}
      </div>
    </>
  )
}
