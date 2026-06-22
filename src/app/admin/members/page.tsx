'use client'
import React, { useEffect, useState } from 'react'
import { adminGetMembers, type AdminMember } from '@/lib/db-admin'
import { supabase } from '@/lib/supabase'

const RANK_ORDER = ['R0','R1','R2','R3','R4','R5']
const RANK_COLOR: Record<string, string> = {
  R0: '#64748b', R1: '#34d399', R2: '#60a5fa',
  R3: '#fbbf24', R4: '#f97316', R5: '#a78bfa',
}

function fmtSales(n: number) {
  return n > 0 ? n.toLocaleString('ko-KR', { maximumFractionDigits: 0 }) : '—'
}
function Shimmer() {
  return <div style={{ height:14, borderRadius:4, width:'70%', background:'linear-gradient(90deg,var(--bg-inset) 25%,rgba(148,163,184,0.06) 50%,var(--bg-inset) 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.4s infinite' }}/>
}

// ── 편집 모달 ─────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  active:    '정상',
  suspended: '정지',
  expelled:  '제명',
}
const STATUS_COLOR: Record<string, string> = {
  active:    '#34d399',
  suspended: '#fbbf24',
  expelled:  '#f87171',
}

function EditModal({ member, onClose, onSaved }: {
  member: AdminMember
  onClose: () => void
  onSaved: () => void
}) {
  const p = member.profile
  const [rank,   setRank]   = useState(p.rank)
  const [mt5,    setMt5]    = useState(p.mt5_account_id ?? '')
  const [trc20,  setTrc20]  = useState(p.trc20_address  ?? '')
  const [status, setStatus] = useState(p.status ?? 'active')
  const [reason, setReason] = useState('')
  const [busy,   setBusy]   = useState(false)
  const [err,    setErr]    = useState('')
  const [ok,     setOk]     = useState(false)

  type StatusHistRow = { id: string; old_status: string; new_status: string; reason: string | null; changed_at: string }
  const [history,     setHistory]     = useState<StatusHistRow[] | null>(null)
  const [histLoading, setHistLoading] = useState(false)
  const [histOpen,    setHistOpen]    = useState(false)

  const origStatus = p.status ?? 'active'
  const statusChanged = status !== origStatus

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
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
        .eq('profile_id', p.id)
        .order('changed_at', { ascending: false })
        .limit(50)
      if (error) throw error
      setHistory(data ?? [])
      setHistOpen(true)
    } catch (e: unknown) {
      setHistory([])
      setHistOpen(true)
    } finally {
      setHistLoading(false)
    }
  }

  async function handleSave() {
    if (statusChanged && status !== 'active' && !reason.trim()) {
      setErr('정지/제명 사유를 입력해주세요')
      return
    }
    setBusy(true); setErr('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const body: Record<string, unknown> = { id: p.id, rank, mt5_account_id: mt5, trc20_address: trc20, status }
      if (statusChanged) body.status_reason = reason.trim()
      const res = await fetch('/api/admin/member', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setOk(true)
      setTimeout(() => { onSaved(); onClose() }, 800)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '오류')
    } finally {
      setBusy(false)
    }
  }

  const rc  = RANK_COLOR[rank]
  const sc  = STATUS_COLOR[status]

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(3px)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ width:460, background:'var(--bg-surface)', border:'1px solid var(--border-primary)', borderRadius:12, overflow:'hidden', boxShadow:'0 24px 80px rgba(0,0,0,0.6)' }}>

        {/* 헤더 */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border-primary)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontFamily:'var(--font-main)', fontSize:15, fontWeight:700, color:'var(--text-primary)', display:'flex', alignItems:'center', gap:8 }}>
              {p.name}
              <span style={{ fontFamily:'var(--font-mono)', fontSize:10, fontWeight:700, color:STATUS_COLOR[origStatus], background:STATUS_COLOR[origStatus]+'18', border:`1px solid ${STATUS_COLOR[origStatus]}44`, padding:'2px 7px', borderRadius:4 }}>
                {STATUS_LABEL[origStatus]}
              </span>
            </div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--accent-blue)', marginTop:2 }}>{p.node_id}</div>
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
                const c = RANK_COLOR[r]
                const active = rank === r
                return (
                  <button key={r} onClick={() => setRank(r as import('@/lib/types').Rank)}
                    style={{ padding:'6px 14px', borderRadius:5, border:`1px solid ${active ? c : 'var(--border-secondary)'}`, background: active ? c+'18' : 'transparent', color: active ? c : 'var(--text-tertiary)', fontFamily:'var(--font-mono)', fontSize:12, fontWeight:700, cursor:'pointer', transition:'all 0.15s' }}>
                    {r}
                  </button>
                )
              })}
            </div>
          </div>

          {/* MT5 */}
          <div>
            <label style={{ fontFamily:'var(--font-main)', fontSize:11, color:'var(--text-tertiary)', display:'block', marginBottom:6 }}>MT5 계좌 번호</label>
            <input value={mt5} onChange={e => setMt5(e.target.value.replace(/\D/g,''))} maxLength={12}
              placeholder="MT5 계좌 번호"
              style={{ width:'100%', padding:'9px 12px', boxSizing:'border-box', background:'var(--bg-inset)', border:'1px solid var(--border-secondary)', borderRadius:6, color:'var(--text-primary)', fontFamily:'var(--font-mono)', fontSize:13, outline:'none' }}
              onFocus={e => (e.currentTarget.style.borderColor='#60a5fa')}
              onBlur={e => (e.currentTarget.style.borderColor='var(--border-secondary)')}/>
          </div>

          {/* TRC-20 */}
          <div>
            <label style={{ fontFamily:'var(--font-main)', fontSize:11, color:'var(--text-tertiary)', display:'block', marginBottom:6 }}>TRC-20 지갑 주소</label>
            <input value={trc20} onChange={e => setTrc20(e.target.value)}
              placeholder="T로 시작하는 34자리"
              style={{ width:'100%', padding:'9px 12px', boxSizing:'border-box', background:'var(--bg-inset)', border:'1px solid var(--border-secondary)', borderRadius:6, color:'var(--text-primary)', fontFamily:'var(--font-mono)', fontSize:12, outline:'none' }}
              onFocus={e => (e.currentTarget.style.borderColor='#34d399')}
              onBlur={e => (e.currentTarget.style.borderColor='var(--border-secondary)')}/>
          </div>

          {/* 회원 상태 */}
          <div style={{ borderTop:'1px solid var(--border-primary)', paddingTop:16 }}>
            <label style={{ fontFamily:'var(--font-main)', fontSize:11, color:'var(--text-tertiary)', display:'block', marginBottom:8 }}>
              회원 상태
              <span style={{ marginLeft:6, fontFamily:'var(--font-main)', fontSize:10, color:'var(--text-tertiary)' }}>
                · 정지/제명 시 해당 노드 수당은 낙전 처리됩니다
              </span>
            </label>
            <div style={{ display:'flex', gap:6 }}>
              {(['active','suspended','expelled'] as const).map(s => {
                const c = STATUS_COLOR[s]
                const active = status === s
                return (
                  <button key={s} onClick={() => setStatus(s)}
                    style={{ flex:1, padding:'8px 0', borderRadius:5, border:`1px solid ${active ? c : 'var(--border-secondary)'}`, background: active ? c+'18' : 'transparent', color: active ? c : 'var(--text-tertiary)', fontFamily:'var(--font-main)', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.15s' }}>
                    {STATUS_LABEL[s]}
                  </button>
                )
              })}
            </div>
            {/* 사유 입력 (정지/제명으로 변경 시) */}
            {statusChanged && status !== 'active' && (
              <div style={{ marginTop:10 }}>
                <label style={{ fontFamily:'var(--font-main)', fontSize:11, color: sc, display:'block', marginBottom:6 }}>
                  {STATUS_LABEL[status]} 사유 <span style={{ color:'#f87171' }}>*</span>
                </label>
                <textarea value={reason} onChange={e => { setReason(e.target.value); setErr('') }}
                  placeholder={`${STATUS_LABEL[status]} 사유를 입력해주세요`}
                  rows={2}
                  style={{ width:'100%', padding:'9px 12px', boxSizing:'border-box', background:'var(--bg-inset)', border:`1px solid ${sc}66`, borderRadius:6, color:'var(--text-primary)', fontFamily:'var(--font-main)', fontSize:13, outline:'none', resize:'vertical', lineHeight:1.5 }}/>
              </div>
            )}
            {statusChanged && status === 'active' && (
              <div style={{ marginTop:8, fontFamily:'var(--font-main)', fontSize:11, color:'#34d399' }}>
                ↩ 정상 상태로 복구합니다
              </div>
            )}
          </div>

          {/* 상태 변경 이력 */}
          <div style={{ borderTop:'1px solid var(--border-primary)', paddingTop:12 }}>
            <button
              onClick={loadHistory}
              style={{ display:'flex', alignItems:'center', gap:6, background:'transparent', border:'none', cursor:'pointer', padding:0 }}
            >
              <span style={{ fontFamily:'var(--font-main)', fontSize:11, fontWeight:600, color:'var(--text-tertiary)' }}>상태 변경 이력</span>
              {histLoading
                ? <span style={{ fontFamily:'var(--font-main)', fontSize:10, color:'var(--text-tertiary)' }}>로딩...</span>
                : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5" style={{ transition:'transform 0.2s', transform: histOpen ? 'rotate(180deg)' : 'none' }}><polyline points="6 9 12 15 18 9"/></svg>
              }
            </button>

            {histOpen && history !== null && (
              <div style={{ marginTop:8 }}>
                {history.length === 0 ? (
                  <div style={{ fontFamily:'var(--font-main)', fontSize:11, color:'var(--text-tertiary)', padding:'8px 0' }}>이력 없음</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:160, overflowY:'auto' }}>
                    {history.map(h => {
                      const OLD_C = h.old_status === 'active' ? '#34d399' : h.old_status === 'suspended' ? '#fbbf24' : '#f87171'
                      const NEW_C = h.new_status === 'active' ? '#34d399' : h.new_status === 'suspended' ? '#fbbf24' : '#f87171'
                      const OLD_L = h.old_status === 'active' ? '정상' : h.old_status === 'suspended' ? '정지' : '제명'
                      const NEW_L = h.new_status === 'active' ? '정상' : h.new_status === 'suspended' ? '정지' : '제명'
                      return (
                        <div key={h.id} style={{ background:'var(--bg-inset)', border:'1px solid var(--border-primary)', borderRadius:6, padding:'8px 12px', display:'grid', gridTemplateColumns:'auto 1fr auto', gap:10, alignItems:'center' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                            <span style={{ fontFamily:'var(--font-main)', fontSize:11, fontWeight:600, color:OLD_C }}>{OLD_L}</span>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                            <span style={{ fontFamily:'var(--font-main)', fontSize:11, fontWeight:700, color:NEW_C }}>{NEW_L}</span>
                          </div>
                          <span style={{ fontFamily:'var(--font-main)', fontSize:11, color:'var(--text-tertiary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {h.reason ?? '—'}
                          </span>
                          <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-tertiary)', whiteSpace:'nowrap' }}>{h.changed_at.slice(0,10)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {err && <div style={{ fontFamily:'var(--font-main)', fontSize:12, color:'#f87171', padding:'8px 12px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:6 }}>{err}</div>}
          {ok  && <div style={{ fontFamily:'var(--font-main)', fontSize:12, color:'#34d399' }}>✓ 저장됐습니다</div>}

          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 }}>
            <button onClick={onClose}
              style={{ padding:'9px 18px', borderRadius:6, border:'1px solid var(--border-secondary)', background:'transparent', color:'var(--text-secondary)', fontFamily:'var(--font-main)', fontSize:13, cursor:'pointer' }}>
              취소
            </button>
            <button onClick={handleSave} disabled={busy || ok}
              style={{ padding:'9px 18px', borderRadius:6, border:'none', background: ok ? '#34d399' : status !== 'active' ? STATUS_COLOR[status] : rc, color:'#000', fontFamily:'var(--font-main)', fontSize:13, fontWeight:600, cursor: busy||ok ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1, transition:'all 0.15s' }}>
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
  const [members,  setMembers]  = useState<AdminMember[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [search,   setSearch]   = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing,  setEditing]  = useState<AdminMember | null>(null)

  // 직급 재계산
  const [recalcBusy, setRecalcBusy] = useState(false)
  const [recalcMsg,  setRecalcMsg]  = useState('')

  // 미등록 회원 (가입했지만 노드 없음)
  type Unregistered = { id: string; email: string; name: string; phone: string | null; trc20: string | null; is_admin: boolean; confirmed: boolean; created_at: string }
  const [unreg, setUnreg] = useState<Unregistered[]>([])
  const [unregOpen, setUnregOpen] = useState(true)

  async function loadUnregistered() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const res = await fetch('/api/admin/unregistered-members', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (res.ok) setUnreg(json.members)
    } catch { /* noop */ }
  }

  function load() {
    setLoading(true)
    adminGetMembers()
      .then(setMembers)
      .catch(e => setError(e?.message ?? '로딩 오류'))
      .finally(() => setLoading(false))
    loadUnregistered()
  }
  useEffect(() => { load() }, [])

  async function handleRecalc() {
    setRecalcBusy(true); setRecalcMsg('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const res  = await fetch('/api/rank-check', { method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body: JSON.stringify({ all: true }) })
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

  const filtered = members.filter(m =>
    !search ||
    m.profile.name.includes(search) ||
    m.profile.node_id.includes(search) ||
    m.profile.ct_id.includes(search) ||
    m.profile.referral_code.includes(search.toUpperCase())
  )

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .member-row { transition: background 0.12s; cursor: pointer; }
        .member-row:hover { background: rgba(148,163,184,0.03); }
        .edit-btn { opacity:0; transition: opacity 0.15s; }
        .member-row:hover .edit-btn { opacity:1; }
        .member-row td, thead th { vertical-align: middle; line-height: 1; }
        .member-row td span { vertical-align: middle; }
      `}</style>

      {editing && (
        <EditModal member={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
      )}

      <div style={{ padding:28, display:'flex', flexDirection:'column', gap:20, maxWidth:1600, margin:'0 auto', width:'100%', boxSizing:'border-box' }}>

        {/* 헤더 */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12 }}>
          <div>
            <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)', marginBottom:4, fontFamily:'var(--font-main)' }}>회원 관리</h1>
            <p style={{ fontSize:12, color:'var(--text-tertiary)', fontFamily:'var(--font-main)' }}>
              {loading ? '로딩 중...' : `전체 ${members.length}명 · 하위 노드 보유 ${members.filter(m=>m.directLegs.length>0).length}명`}
            </p>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            {/* 직급 재계산 */}
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {recalcMsg && <span style={{ fontFamily:'var(--font-main)', fontSize:12, color: recalcMsg.includes('완료') ? '#34d399' : '#f87171' }}>{recalcMsg}</span>}
              <button onClick={handleRecalc} disabled={recalcBusy}
                style={{ padding:'8px 14px', borderRadius:6, border:'1px solid var(--border-secondary)', background:'transparent', color:'var(--text-secondary)', fontFamily:'var(--font-main)', fontSize:12, cursor: recalcBusy ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', gap:6, opacity: recalcBusy ? 0.5 : 1 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: recalcBusy ? 'spin 1s linear infinite' : 'none' }}>
                  <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                {recalcBusy ? '계산 중...' : '직급 재계산'}
              </button>
            </div>
            {/* 검색 */}
            <div style={{ position:'relative' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름, 노드ID, CT, 추천코드 검색"
                style={{ background:'var(--bg-surface)', border:'1px solid var(--border-secondary)', color:'var(--text-primary)', padding:'8px 14px 8px 32px', borderRadius:4, fontSize:12, fontFamily:'var(--font-main)', outline:'none', width:240 }}/>
            </div>
          </div>
        </div>

        {error && <div style={{ padding:'12px 16px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:6, fontFamily:'var(--font-main)', fontSize:13, color:'#f87171' }}>⚠ {error}</div>}

        {/* 미등록 회원 (가입했지만 노드 없음) */}
        {unreg.length > 0 && (
          <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border-primary)', borderRadius:8, overflow:'hidden' }}>
            <button onClick={() => setUnregOpen(o => !o)}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'rgba(251,191,36,0.06)', border:'none', borderBottom: unregOpen ? '1px solid var(--border-primary)' : 'none', cursor:'pointer', textAlign:'left' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" style={{ transition:'transform 0.2s', transform: unregOpen ? 'rotate(90deg)' : 'none' }}><polyline points="9 18 15 12 9 6"/></svg>
              <span style={{ fontFamily:'var(--font-main)', fontSize:13, fontWeight:600, color:'#fbbf24' }}>미등록 회원 (가입했지만 노드 없음)</span>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:12, fontWeight:700, color:'#fbbf24', background:'rgba(251,191,36,0.12)', border:'1px solid rgba(251,191,36,0.35)', padding:'1px 8px', borderRadius:10 }}>{unreg.length}</span>
            </button>
            {unregOpen && (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', minWidth:760, borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid var(--border-primary)', background:'rgba(10,12,16,0.3)' }}>
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
                          {u.is_admin && <span style={{ marginLeft:6, fontFamily:'var(--font-mono)', fontSize:9, color:'#ef4444', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', padding:'1px 5px', borderRadius:3 }}>관리자</span>}
                        </td>
                        <td style={{ padding:'10px 16px', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text-secondary)' }}>{u.email}</td>
                        <td style={{ padding:'10px 16px', fontFamily:'var(--font-mono)', fontSize:12, color: u.phone ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>{u.phone ?? '—'}</td>
                        <td style={{ padding:'10px 16px', fontFamily:'var(--font-mono)', fontSize:11, color: u.trc20 ? '#34d399' : 'var(--text-tertiary)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.trc20 ?? '—'}</td>
                        <td style={{ padding:'10px 16px' }}>
                          <span style={{ fontFamily:'var(--font-main)', fontSize:11, fontWeight:600, color: u.confirmed ? '#34d399' : '#fbbf24' }}>{u.confirmed ? '완료' : '대기'}</span>
                        </td>
                        <td style={{ padding:'10px 16px', fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-tertiary)', whiteSpace:'nowrap' }}>{u.created_at.slice(0,10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 테이블 */}
        <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border-primary)', borderRadius:8, overflowX:'auto', overflowY:'hidden' }}>
          <table style={{ width:'100%', minWidth:980, borderCollapse:'collapse', tableLayout:'fixed', verticalAlign:'middle' }}>
            <colgroup>
              <col style={{ width:40 }}/>
              <col style={{ width:'16%' }}/>
              <col style={{ width:'10%' }}/>
              <col style={{ width:68 }}/>
              <col style={{ width:76 }}/>
              <col style={{ width:'18%' }}/>
              <col style={{ width:'10%' }}/>
              <col style={{ width:96 }}/>
              <col style={{ width:52 }}/>
              <col style={{ width:72 }}/>
              <col style={{ width:64 }}/>
            </colgroup>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border-primary)', background:'rgba(10,12,16,0.3)' }}>
                {[
                  { label:'',           align:'left'   },
                  { label:'회원 / 노드 ID', align:'left'   },
                  { label:'CT ID',       align:'left'   },
                  { label:'직급',         align:'center' },
                  { label:'상태',         align:'center' },
                  { label:'TRC-20 지갑주소', align:'left' },
                  { label:'MT5 계좌 ID',  align:'left'   },
                  { label:'가입일',        align:'left'   },
                  { label:'레그',         align:'center' },
                  { label:'전체 하위',     align:'center' },
                  { label:'',           align:'left'   },
                ].map((h,i) => (
                  <th key={i} style={{ padding:'10px 16px', textAlign: h.align as 'left'|'center', fontSize:11, fontFamily:'var(--font-main)', color:'var(--text-tertiary)', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden' }}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({length:6}).map((_,i) => (
                    <tr key={i} style={{ borderBottom:'1px solid var(--border-primary)' }}>
                      {Array.from({length:11}).map((__,j) => <td key={j} style={{ padding:'14px 16px' }}><Shimmer/></td>)}
                    </tr>
                  ))
                : filtered.map((m, mi) => {
                    const { profile, directLegs, ownedNodes, totalDownline } = m
                    const isExp = expanded === profile.id
                    const rc    = RANK_COLOR[profile.rank] ?? '#64748b'
                    const pStatus = profile.status ?? 'active'
                    const sc    = STATUS_COLOR[pStatus] ?? '#34d399'
                    const isBlank = pStatus !== 'active'
                    return (
                      <React.Fragment key={profile.id}>
                        <tr className="member-row"
                          onClick={() => setExpanded(isExp ? null : profile.id)}
                          style={{ borderBottom: isExp ? 'none' : mi < filtered.length-1 ? '1px solid var(--border-primary)' : 'none', opacity: isBlank ? 0.65 : 1 }}>
                          <td style={{ padding:'12px 8px 12px 16px', width:28 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" style={{ transition:'transform 0.2s', transform: isExp ? 'rotate(90deg)' : 'rotate(0deg)' }}><polyline points="9 18 15 12 9 6"/></svg>
                          </td>
                          <td style={{ padding:'12px 16px' }}>
                            <div style={{ fontFamily:'var(--font-main)', fontSize:13, color: isBlank ? 'var(--text-tertiary)' : 'var(--text-primary)', fontWeight:500, marginBottom:2 }}>{profile.name}</div>
                            <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--accent-blue)' }}>{profile.node_id}</div>
                          </td>
                          <td style={{ padding:'12px 16px', fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-secondary)' }}>{profile.ct_id}</td>
                          <td style={{ padding:'12px 16px', textAlign:'center' }}>
                            <span style={{ fontFamily:'var(--font-mono)', fontSize:11, fontWeight:700, color:rc, background:rc+'18', border:`1px solid ${rc}44`, padding:'2px 7px', borderRadius:4 }}>{profile.rank}</span>
                          </td>
                          <td style={{ padding:'12px 16px', textAlign:'center' }}>
                            <span style={{ fontFamily:'var(--font-main)', fontSize:11, fontWeight:600, color:sc, background:sc+'18', border:`1px solid ${sc}44`, padding:'2px 7px', borderRadius:4 }}>{STATUS_LABEL[pStatus]}</span>
                          </td>
                          <td style={{ padding:'12px 16px', maxWidth:200 }}>
                            {profile.trc20_address
                              ? <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'#34d399', display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{profile.trc20_address}</span>
                              : <span style={{ fontFamily:'var(--font-main)', fontSize:11, color:'var(--text-tertiary)' }}>미등록</span>}
                          </td>
                          <td style={{ padding:'12px 16px' }}>
                            {profile.mt5_account_id
                              ? <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'#60a5fa' }}>{profile.mt5_account_id}</span>
                              : <span style={{ fontFamily:'var(--font-main)', fontSize:11, color:'var(--text-tertiary)' }}>미등록</span>}
                          </td>
                          <td style={{ padding:'12px 16px', fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-tertiary)', whiteSpace:'nowrap' }}>{profile.created_at.slice(0,10)}</td>
                          <td style={{ padding:'12px 16px', textAlign:'center', fontFamily:'var(--font-mono)', fontSize:14, fontWeight:700, color: directLegs.length>0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{directLegs.length}</td>
                          <td style={{ padding:'12px 16px', textAlign:'center', fontFamily:'var(--font-mono)', fontSize:12, color: totalDownline>0 ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>{totalDownline}</td>
                          {/* 편집 버튼 */}
                          <td style={{ padding:'12px 16px' }}>
                            <button className="edit-btn" onClick={e => { e.stopPropagation(); setEditing(m) }}
                              style={{ padding:'5px 10px', borderRadius:5, border:'1px solid var(--border-secondary)', background:'transparent', color:'var(--text-secondary)', fontFamily:'var(--font-main)', fontSize:11, cursor:'pointer' }}>
                              편집
                            </button>
                          </td>
                        </tr>
                        {isExp && (
                          <tr style={{ borderBottom: mi < filtered.length-1 ? '1px solid var(--border-primary)' : 'none' }}>
                            <td colSpan={11} style={{ padding:'0 16px 16px 56px', background:'rgba(10,12,16,0.3)' }}>
                              <div style={{ paddingTop:12 }}>
                                <div style={{ fontSize:10, fontFamily:'var(--font-main)', fontWeight:600, color:'var(--text-tertiary)', marginBottom:8 }}>보유 노드 ({ownedNodes.length})</div>
                                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                                  {ownedNodes.map(node => {
                                    const lrc = RANK_COLOR[node.rank] ?? '#64748b'
                                    const isSelf = node.id === profile.id
                                    return (
                                      <div key={node.id} style={{ display:'grid', gridTemplateColumns:'84px 1fr 104px 90px 52px 80px 96px', gap:'0 16px', padding:'9px 14px', background:'var(--bg-surface)', border:`1px solid ${isSelf ? 'var(--accent-blue)' : 'var(--border-primary)'}`, borderRadius:5, alignItems:'center' }}>
                                        <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'#60a5fa' }}>{node.leg_position === 'LEFT' ? '← LEFT' : node.leg_position === 'RIGHT' ? 'RIGHT →' : '— ROOT'}</div>
                                        <div style={{ minWidth:0 }}>
                                          <div style={{ fontFamily:'var(--font-main)', fontSize:12, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                            {node.name}
                                            {isSelf && <span style={{ marginLeft:6, fontFamily:'var(--font-main)', fontSize:10, fontWeight:600, color:'var(--accent-blue)', background:'var(--accent-blue-dim)', padding:'1px 6px', borderRadius:4, verticalAlign:'middle' }}>현재</span>}
                                          </div>
                                          <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--accent-blue)' }}>{node.node_id}</div>
                                        </div>
                                        {/* 추천코드 */}
                                        <div style={{ minWidth:0 }}>
                                          <div style={{ fontFamily:'var(--font-main)', fontSize:8, color:'var(--text-tertiary)', marginBottom:2 }}>추천코드</div>
                                          <span style={{ fontFamily:'var(--font-mono)', fontSize:11, fontWeight:600, letterSpacing:'0.04em', color:'#a78bfa' }}>{node.referral_code || '—'}</span>
                                        </div>
                                        <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-secondary)', textAlign:'right' }}>{fmtSales(node.sales)}</div>
                                        <span style={{ justifySelf:'start', fontFamily:'var(--font-mono)', fontSize:10, fontWeight:700, color:lrc, background:lrc+'18', border:`1px solid ${lrc}44`, padding:'2px 6px', borderRadius:3, whiteSpace:'nowrap' }}>{node.rank}</span>
                                        <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color: node.mt5_account_id ? '#60a5fa' : 'var(--text-tertiary)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{node.mt5_account_id ?? '—'}</div>
                                        <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-tertiary)', textAlign:'right', whiteSpace:'nowrap' }}>{node.created_at.slice(0,10)}</div>
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
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  )
}
