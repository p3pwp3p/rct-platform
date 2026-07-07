'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useIsMobile } from '@/lib/useIsMobile'
import type { Profile } from '@/lib/types'

// ── Toast ─────────────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error'
function Toast({ msg, type, onDone }: { msg: string; type: ToastType; onDone: () => void }) {
  const color  = type === 'success' ? '#34d399' : '#f87171'
  const bg     = type === 'success' ? 'rgba(52,211,153,0.10)' : 'rgba(248,113,113,0.10)'
  const border = type === 'success' ? 'rgba(52,211,153,0.30)' : 'rgba(248,113,113,0.30)'
  const icon   = type === 'success'
    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>

  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div style={{
      position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9000, pointerEvents: 'none',
      animation: 'toastIn 0.28s cubic-bezier(0.16,1,0.3,1)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '11px 18px', borderRadius: 8,
        background: bg, border: `1px solid ${border}`,
        backdropFilter: 'blur(12px)',
        boxShadow: `0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px ${border}`,
        minWidth: 200, maxWidth: 360,
      }}>
        {icon}
        <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, color, whiteSpace: 'nowrap' }}>{msg}</span>
      </div>
    </div>
  )
}

const RANK_COLOR: Record<string, string> = {
  R0: '#64748b', R1: '#34d399', R2: '#60a5fa',
  R3: '#fbbf24', R4: '#f97316', R5: '#a78bfa',
}
const RANK_ORDER = ['R0','R1','R2','R3','R4','R5']

function Sk({ w = '100%', h = 14 }: { w?: string | number; h?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 4,
      background: 'linear-gradient(90deg,var(--bg-inset) 25%,rgba(148,163,184,0.08) 50%,var(--bg-inset) 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
    }} />
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--border-primary)' }}>
      <span style={{ fontFamily: 'var(--font-main)', fontSize: 14, color: 'var(--text-tertiary)', flexShrink: 0 }}>{label}</span>
      <div style={{ fontFamily: 'var(--font-main)', fontSize: 14, color: 'var(--text-primary)', textAlign: 'right', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</div>
    </div>
  )
}

export default function ProfilePage() {
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [nodes, setNodes]         = useState<Profile[]>([])
  const [authEmail, setAuthEmail]   = useState('')
  const [fullName, setFullName]     = useState('')
  const [phone, setPhone]           = useState('')
  const [authTrc20, setAuthTrc20]   = useState('')  // auth 메타데이터 기준 TRC-20
  const [loading, setLoading]       = useState(true)
  const isMobile = useIsMobile()

  // ── 토스트 ────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null)
  const toastKey = useRef(0)
  const showToast = useCallback((msg: string, type: ToastType = 'success') => {
    toastKey.current += 1
    setToast({ msg, type })
  }, [])

  // 이름 수정
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput]     = useState('')
  const [nameBusy, setNameBusy]       = useState(false)

  // 전화번호 수정
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneInput, setPhoneInput]     = useState('')
  const [phoneBusy, setPhoneBusy]       = useState(false)

  // TRC-20 지갑
  const [editingWallet, setEditingWallet] = useState(false)
  const [walletInput, setWalletInput]     = useState('')
  const [walletBusy, setWalletBusy]       = useState(false)

  // 노드별 MT5 계좌 (편집 중인 노드 id)
  const [editingMt5, setEditingMt5] = useState<string | null>(null)
  const [mt5Input, setMt5Input]     = useState('')
  const [mt5Busy, setMt5Busy]       = useState(false)

  // 노드별 이름 (편집 중인 노드 id)
  const [editingNodeName, setEditingNodeName] = useState<string | null>(null)
  const [nodeNameInput, setNodeNameInput]     = useState('')
  const [nodeNameBusy, setNodeNameBusy]       = useState(false)

  // 노드 삭제 (확인 중인 노드 id)
  const [confirmDeleteNode, setConfirmDeleteNode] = useState<string | null>(null)
  const [deleteBusy, setDeleteBusy]               = useState(false)

  // 비밀번호
  const [pwOpen, setPwOpen]   = useState(false)
  const [pwCur, setPwCur]     = useState('')
  const [pwNew, setPwNew]     = useState('')
  const [pwConf, setPwConf]   = useState('')
  const [pwBusy, setPwBusy]   = useState(false)
  const [pwErr, setPwErr]     = useState('')

  const displayName = myProfile?.name || fullName || '—'

  const handleSaveName = async () => {
    const name = nameInput.trim()
    if (!name) { showToast('이름을 입력해주세요', 'error'); return }
    if (name.length > 30) { showToast('이름이 너무 깁니다 (30자 이하)', 'error'); return }
    setNameBusy(true)
    const { error: aErr } = await supabase.auth.updateUser({ data: { full_name: name } })
    let pErr = null
    if (myProfile) {
      const { error } = await supabase.from('profiles').update({ name }).eq('id', myProfile.id)
      pErr = error
    }
    setNameBusy(false)
    if (aErr || pErr) { showToast((aErr ?? pErr)!.message, 'error'); return }
    setFullName(name)
    setMyProfile(p => p ? { ...p, name } : p)
    setNodes(ns => ns.map(n => n.id === myProfile?.id ? { ...n, name } : n))
    setEditingName(false)
    showToast('이름이 저장됐습니다')
  }

  const handleSavePhone = async () => {
    const p = phoneInput.trim()
    setPhoneBusy(true)
    const { error } = await supabase.auth.updateUser({ data: { phone: p || null } })
    setPhoneBusy(false)
    if (error) { showToast(error.message, 'error'); return }
    setPhone(p)
    setEditingPhone(false)
    showToast('전화번호가 저장됐습니다')
  }

  const handleDeleteNode = async (nodeId: string) => {
    setDeleteBusy(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/delete-node', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId, accessToken: session?.access_token ?? '' }),
    })
    const json = await res.json().catch(() => ({}))
    setDeleteBusy(false)
    setConfirmDeleteNode(null)
    if (!res.ok) { showToast(json.error ?? '삭제 실패', 'error'); return }
    setNodes(ns => ns.filter(n => n.id !== nodeId))
    showToast('노드가 삭제됐습니다')
  }

  const handleSaveNodeName = async (nodeId: string) => {
    const nm = nodeNameInput.trim()
    if (!nm) { showToast('이름을 입력해주세요', 'error'); return }
    if (nm.length > 30) { showToast('이름이 너무 깁니다 (30자 이하)', 'error'); return }
    setNodeNameBusy(true)
    const { error } = await supabase.from('profiles').update({ name: nm }).eq('id', nodeId)
    // 메인 노드면 계정 표시 이름(auth full_name)도 동기화
    if (!error && nodeId === myProfile?.id) {
      await supabase.auth.updateUser({ data: { full_name: nm } })
      setFullName(nm)
      setMyProfile(p => p ? { ...p, name: nm } : p)
    }
    setNodeNameBusy(false)
    if (error) { showToast(error.message, 'error'); return }
    setNodes(ns => ns.map(n => n.id === nodeId ? { ...n, name: nm } : n))
    setEditingNodeName(null)
    showToast('노드 이름이 저장됐습니다')
  }

  const handleSaveMt5 = async (nodeId: string) => {
    const v = mt5Input.trim()
    setMt5Busy(true)
    const { error } = await supabase.from('profiles').update({ mt5_account_id: v || null }).eq('id', nodeId)
    setMt5Busy(false)
    if (error) { showToast(error.message, 'error'); return }
    setNodes(ns => ns.map(n => n.id === nodeId ? { ...n, mt5_account_id: v || null } : n))
    setEditingMt5(null)
    showToast('Vantage C.T 계정이 저장됐습니다')
  }

  const handleSaveWallet = async () => {
    const addr = walletInput.trim()
    if (addr && !/^T[A-Za-z0-9]{33}$/.test(addr)) {
      showToast('유효하지 않은 TRC-20 주소입니다', 'error'); return
    }
    setWalletBusy(true)
    const { error: aErr } = await supabase.auth.updateUser({ data: { trc20_address: addr || null } })
    let pErr = null
    if (myProfile) {
      const { error } = await supabase.from('profiles').update({ trc20_address: addr || null }).eq('id', myProfile.id)
      pErr = error
    }
    setWalletBusy(false)
    if (aErr) { showToast(aErr.message, 'error'); return }
    if (pErr) console.warn('profiles trc20 update:', pErr.message)
    setAuthTrc20(addr)
    setMyProfile(p => p ? { ...p, trc20_address: addr || null } : p)
    setEditingWallet(false)
    showToast('지갑 주소가 저장됐습니다')
  }

  useEffect(() => {
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setAuthEmail(user.email ?? '')
      setFullName((user.user_metadata?.full_name as string) ?? '')
      setPhone((user.user_metadata?.phone as string) ?? '')
      setAuthTrc20((user.user_metadata?.trc20_address as string) ?? '')

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setMyProfile(profile as Profile)

      const { data: owned } = await supabase
        .from('profiles').select('*')
        .or(`id.eq.${user.id},owner_id.eq.${user.id}`)
        .order('created_at', { ascending: true })
      setNodes((owned ?? []) as Profile[])
      setLoading(false)
    }
    run()
  }, [])

  // 최고 직급: 소유 노드 중 가장 높은 직급
  const topRank = nodes.reduce<string>((best, n) => {
    return RANK_ORDER.indexOf(n.rank) > RANK_ORDER.indexOf(best) ? n.rank : best
  }, 'R0')
  const topRc = RANK_COLOR[topRank]

  const handlePwChange = async () => {
    setPwErr('')
    if (pwNew.length < 8)    { setPwErr('새 비밀번호는 8자 이상이어야 합니다.'); return }
    if (pwNew !== pwConf)     { setPwErr('비밀번호가 일치하지 않습니다'); return }
    setPwBusy(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) {
      const { error: e } = await supabase.auth.signInWithPassword({ email: user.email, password: pwCur })
      if (e) { setPwBusy(false); setPwErr('현재 비밀번호가 올바르지 않습니다'); return }
    }
    const { error } = await supabase.auth.updateUser({ password: pwNew })
    setPwBusy(false)
    if (error) {
      if (error.message.includes('should be different')) {
        setPwErr('기존 비밀번호와 다른 비밀번호를 사용해주세요.')
      } else if (error.message.includes('weak') || error.message.includes('at least')) {
        setPwErr('더 강력한 비밀번호를 사용해주세요.')
      } else {
        setPwErr(error.message)
      }
      return
    }
    showToast('비밀번호가 변경됐습니다')
    setPwCur(''); setPwNew(''); setPwConf(''); setPwOpen(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {toast && <Toast key={toastKey.current} msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(-12px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        .pf-input {
          width: 100%; padding: 9px 12px; border-radius: 6px;
          background: var(--bg-inset); border: 1px solid var(--border-primary);
          color: var(--text-primary); font-size: 13px; font-family: var(--font-main);
          outline: none; box-sizing: border-box; transition: border-color 0.15s;
        }
        .pf-input:focus { border-color: var(--accent-blue); }
        .pf-input[type=password] { font-family: var(--font-mono); letter-spacing: 0.12em; }
        .pf-btn {
          padding: 8px 18px; border-radius: 6px; border: none; cursor: pointer;
          font-family: var(--font-main); font-size: 13px; font-weight: 600; transition: opacity 0.15s;
        }
        .pf-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .pf-btn-primary { background: var(--accent-blue); color: #000; }
        .pf-btn-ghost { background: var(--bg-inset); color: var(--text-secondary); border: 1px solid var(--border-primary); }
      `}</style>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: isMobile ? '20px 16px 32px' : '32px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 헤더 */}
          <div style={{ marginBottom: 4 }}>
            <h1 style={{ fontFamily: 'var(--font-main)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>내 프로필</h1>
          </div>

          {/* ── 개인 정보 카드 ── */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10, padding: '4px 20px 4px' }}>

            {/* 이름 */}
            <Row label="이름">
              {loading ? <Sk w={80} h={15} /> : editingName ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input className="pf-input" value={nameInput} maxLength={30} autoFocus
                    onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                    style={{ width: 160, fontSize: 13, padding: '5px 10px' }} />
                  <button className="pf-btn pf-btn-primary" disabled={nameBusy} onClick={handleSaveName} style={{ padding: '4px 10px', fontSize: 11 }}>저장</button>
                  <button className="pf-btn pf-btn-ghost" onClick={() => setEditingName(false)} style={{ padding: '4px 10px', fontSize: 11 }}>취소</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--font-main)', fontSize: 14, fontWeight: 600 }}>{displayName}</span>
                  <button className="pf-btn pf-btn-ghost" onClick={() => { setEditingName(true); setNameInput(displayName === '—' ? '' : displayName) }} style={{ padding: '4px 10px', fontSize: 11 }}>수정</button>
                </div>
              )}
            </Row>

            {/* 이메일 (변경 불가) */}
            <Row label="이메일">
              {loading ? <Sk w={160} h={15} /> : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>{authEmail}</span>}
            </Row>

            {/* 전화번호 */}
            <Row label="전화번호">
              {loading ? <Sk w={120} h={15} /> : editingPhone ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input className="pf-input" value={phoneInput} type="tel" autoFocus
                    onChange={e => setPhoneInput(e.target.value.replace(/[^\d\-+\s]/g, ''))}
                    onKeyDown={e => e.key === 'Enter' && handleSavePhone()}
                    placeholder="010-1234-5678"
                    style={{ width: 160, fontSize: 13, padding: '5px 10px' }} />
                  <button className="pf-btn pf-btn-primary" disabled={phoneBusy} onClick={handleSavePhone} style={{ padding: '4px 10px', fontSize: 11 }}>저장</button>
                  <button className="pf-btn pf-btn-ghost" onClick={() => setEditingPhone(false)} style={{ padding: '4px 10px', fontSize: 11 }}>취소</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: phone ? 'var(--font-mono)' : 'var(--font-main)', fontSize: 14, color: phone ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{phone || '미등록'}</span>
                  <button className="pf-btn pf-btn-ghost" onClick={() => { setEditingPhone(true); setPhoneInput(phone) }} style={{ padding: '4px 10px', fontSize: 11 }}>{phone ? '수정' : '등록'}</button>
                </div>
              )}
            </Row>

            {/* 최고 직급 */}
            <Row label="최고 직급">
              {loading ? <Sk w={48} h={20} /> : (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: topRc, background: topRc + '18', border: `1px solid ${topRc}44`, padding: '2px 10px', borderRadius: 4 }}>
                  {topRank}
                </span>
              )}
            </Row>

            {/* 비밀번호 */}
            <div style={{ padding: '13px 0' }}>
              {!pwOpen ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)' }}>비밀번호</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-tertiary)', letterSpacing: '0.18em' }}>••••••••</span>
                    <button className="pf-btn pf-btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setPwOpen(true)}>변경</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 2 }}>비밀번호 변경</span>
                  {[
                    { label: '현재 비밀번호', val: pwCur, set: setPwCur },
                    { label: '새 비밀번호',   val: pwNew, set: setPwNew },
                    { label: '새 비밀번호 확인', val: pwConf, set: setPwConf },
                  ].map(({ label, val, set }) => (
                    <div key={label}>
                      <label style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 5 }}>{label}</label>
                      <input className="pf-input" type="password" value={val} onChange={e => set(e.target.value.replace(/\s/g, ''))} />
                    </div>
                  ))}
                  {pwErr && <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: '#f87171', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6 }}>{pwErr}</div>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                    <button className="pf-btn pf-btn-primary" disabled={pwBusy} onClick={handlePwChange}>{pwBusy ? '변경 중...' : '변경 완료'}</button>
                    <button className="pf-btn pf-btn-ghost" onClick={() => { setPwOpen(false); setPwErr(''); setPwCur(''); setPwNew(''); setPwConf('') }}>취소</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── 출금 지갑 (계정 단위) ── */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border-primary)', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: isMobile ? 3 : 12 }}>
              <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>출금 지갑</span>
              <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)' }}>모든 노드 수익이 이 주소로 일괄 지급됩니다</span>
            </div>
            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>Binance</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#34d399', letterSpacing: '0.06em' }}>TRC-20</div>
              </div>
              {loading ? (
                <Sk w="60%" h={15} />
              ) : editingWallet ? (
                <>
                  <input
                    className="pf-input"
                    value={walletInput}
                    onChange={e => setWalletInput(e.target.value)}
                    placeholder="T로 시작하는 34자리 주소"
                    style={{ flex: 1, fontSize: 12, padding: '5px 10px', fontFamily: 'var(--font-mono)' }}
                    autoFocus
                  />
                  <button className="pf-btn pf-btn-primary" disabled={walletBusy} onClick={handleSaveWallet} style={{ padding: '4px 10px', fontSize: 11 }}>저장</button>
                  <button className="pf-btn pf-btn-ghost" onClick={() => setEditingWallet(false)} style={{ padding: '4px 10px', fontSize: 11 }}>취소</button>
                </>
              ) : (
                <>
                  {authTrc20 ? (
                    <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {authTrc20.slice(0, 8)}…{authTrc20.slice(-6)}
                    </span>
                  ) : (
                    <span style={{ flex: 1, fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)' }}>미등록</span>
                  )}
                  <button className="pf-btn pf-btn-ghost" onClick={() => { setEditingWallet(true); setWalletInput(authTrc20) }} style={{ padding: '4px 10px', fontSize: 11, flexShrink: 0 }}>
                    {authTrc20 ? '수정' : '등록'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── 노드 목록 ── */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '13px 20px', borderBottom: '1px solid var(--border-primary)', fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
              노드 {!loading && `(${nodes.length})`}
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {loading ? (
                [1,2].map(i => <Sk key={i} h={52} />)
              ) : nodes.length === 0 ? (
                <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)', padding: '4px 0' }}>등록된 노드가 없습니다.</div>
              ) : nodes.map(n => {
                const nc = RANK_COLOR[n.rank]
                const isMain = n.id === myProfile?.id
                return (
                  <div key={n.id} style={{ background: 'var(--bg-inset)', border: `1px solid ${isMain ? nc + '33' : 'var(--border-primary)'}`, borderRadius: 8, overflow: 'hidden' }}>
                    {/* 노드 기본 정보 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: nc + '18', border: `1px solid ${nc}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: nc }}>
                        {n.rank}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {editingNodeName === n.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <input
                              className="pf-input"
                              value={nodeNameInput}
                              onChange={e => setNodeNameInput(e.target.value)}
                              maxLength={30}
                              autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveNodeName(n.id) }}
                              style={{ flex: 1, minWidth: 0, fontSize: 13, padding: '5px 10px' }}
                            />
                            <button className="pf-btn pf-btn-primary" disabled={nodeNameBusy} onClick={() => handleSaveNodeName(n.id)} style={{ padding: '4px 10px', fontSize: 11, flexShrink: 0 }}>저장</button>
                            <button className="pf-btn pf-btn-ghost" onClick={() => setEditingNodeName(null)} style={{ padding: '4px 10px', fontSize: 11, flexShrink: 0 }}>취소</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                            <span style={{ fontFamily: 'var(--font-main)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{n.name}</span>
                            {isMain && <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: nc, background: nc + '18', border: `1px solid ${nc}33`, padding: '1px 6px', borderRadius: 3 }}>메인</span>}
                            <button className="pf-btn pf-btn-ghost" onClick={() => { setEditingNodeName(n.id); setNodeNameInput(n.name) }} style={{ padding: '2px 8px', fontSize: 10, flexShrink: 0 }}>수정</button>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-blue)' }}>{n.node_id}</span>
                          {n.referral_code && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontFamily: 'var(--font-main)', fontSize: 10, color: 'var(--text-tertiary)' }}>추천코드</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#4db6ac' }}>{n.referral_code}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>{n.created_at.slice(0,10)}</span>
                    </div>

                    {/* Vantage C.T 계정 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderTop: '1px solid var(--border-primary)', background: 'rgba(10,12,16,0.2)' }}>
                      <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>Vantage C.T</span>
                      {editingMt5 === n.id ? (
                        <>
                          <input
                            className="pf-input"
                            value={mt5Input}
                            onChange={e => setMt5Input(e.target.value.replace(/\D/g, ''))}
                            maxLength={12}
                            placeholder="Vantage C.T 계정 번호"
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveMt5(n.id) }}
                            style={{ flex: 1, minWidth: 0, fontSize: 12, padding: '5px 10px', fontFamily: 'var(--font-mono)' }}
                          />
                          <button className="pf-btn pf-btn-primary" disabled={mt5Busy} onClick={() => handleSaveMt5(n.id)} style={{ padding: '4px 10px', fontSize: 11, flexShrink: 0 }}>저장</button>
                          <button className="pf-btn pf-btn-ghost" onClick={() => setEditingMt5(null)} style={{ padding: '4px 10px', fontSize: 11, flexShrink: 0 }}>취소</button>
                        </>
                      ) : (
                        <>
                          <span style={{ flex: 1, minWidth: 0, fontFamily: n.mt5_account_id ? 'var(--font-mono)' : 'var(--font-main)', fontSize: n.mt5_account_id ? 13 : 11, fontWeight: n.mt5_account_id ? 600 : 400, color: n.mt5_account_id ? '#60a5fa' : 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {n.mt5_account_id || '미등록'}
                          </span>
                          <button className="pf-btn pf-btn-ghost" onClick={() => { setEditingMt5(n.id); setMt5Input(n.mt5_account_id ?? '') }} style={{ padding: '4px 10px', fontSize: 11, flexShrink: 0 }}>
                            {n.mt5_account_id ? '수정' : '등록'}
                          </button>
                        </>
                      )}
                    </div>

                    {/* 노드 삭제 */}
                    {confirmDeleteNode === n.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', borderTop: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)' }}>
                        <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-main)', fontSize: 11, color: '#f87171', lineHeight: 1.5 }}>이 노드를 삭제할까요? 되돌릴 수 없습니다.</span>
                        <button disabled={deleteBusy} onClick={() => handleDeleteNode(n.id)} style={{ padding: '4px 12px', fontSize: 11, fontWeight: 700, borderRadius: 5, border: 'none', background: '#ef4444', color: '#fff', cursor: deleteBusy ? 'not-allowed' : 'pointer', opacity: deleteBusy ? 0.6 : 1, flexShrink: 0 }}>{deleteBusy ? '삭제 중…' : '삭제'}</button>
                        <button onClick={() => setConfirmDeleteNode(null)} className="pf-btn pf-btn-ghost" style={{ padding: '4px 10px', fontSize: 11, flexShrink: 0 }}>취소</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 16px', borderTop: '1px solid var(--border-primary)' }}>
                        <button onClick={() => setConfirmDeleteNode(n.id)} style={{ padding: '3px 10px', fontSize: 11, borderRadius: 5, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          노드 삭제
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
