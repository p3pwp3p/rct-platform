'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

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
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--border-primary)' }}>
      <span style={{ fontFamily: 'var(--font-main)', fontSize: 14, color: 'var(--text-tertiary)', flexShrink: 0 }}>{label}</span>
      <div style={{ fontFamily: 'var(--font-main)', fontSize: 14, color: 'var(--text-primary)', textAlign: 'right' }}>{children}</div>
    </div>
  )
}

export default function ProfilePage() {
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [nodes, setNodes]         = useState<Profile[]>([])
  const [authEmail, setAuthEmail] = useState('')
  const [loading, setLoading]     = useState(true)


  // TRC-20 주소 편집
  const [editingWallet, setEditingWallet] = useState<string | null>(null) // node id
  const [walletInput, setWalletInput]     = useState('')
  const [walletBusy, setWalletBusy]       = useState(false)
  const [walletMsg, setWalletMsg]         = useState<Record<string, string>>({})

  // MT5 계좌 편집
  const [editingMt5, setEditingMt5]   = useState<string | null>(null) // node id
  const [mt5Input, setMt5Input]       = useState('')
  const [mt5Busy, setMt5Busy]         = useState(false)
  const [mt5Msg, setMt5Msg]           = useState<Record<string, string>>({})

  const handleSaveMt5 = async (nodeId: string) => {
    const val = mt5Input.trim()
    if (val && !/^\d{5,12}$/.test(val)) {
      setMt5Msg(m => ({ ...m, [nodeId]: '5~12자리 숫자를 입력해주세요' }))
      return
    }
    setMt5Busy(true)
    const { error } = await supabase.from('profiles').update({ mt5_account_id: val || null }).eq('id', nodeId)
    setMt5Busy(false)
    if (error) { setMt5Msg(m => ({ ...m, [nodeId]: error.message })); return }
    setNodes(ns => ns.map(n => n.id === nodeId ? { ...n, mt5_account_id: val || null } : n))
    setEditingMt5(null)
    setMt5Msg(m => ({ ...m, [nodeId]: '저장됐습니다' }))
    setTimeout(() => setMt5Msg(m => { const c = { ...m }; delete c[nodeId]; return c }), 2500)
  }

  const handleSaveWallet = async (nodeId: string) => {
    const addr = walletInput.trim()
    if (addr && !/^T[A-Za-z0-9]{33}$/.test(addr)) {
      setWalletMsg(m => ({ ...m, [nodeId]: '유효하지 않은 TRC-20 주소입니다' }))
      return
    }
    setWalletBusy(true)
    const { error } = await supabase.from('profiles').update({ trc20_address: addr || null }).eq('id', nodeId)
    setWalletBusy(false)
    if (error) { setWalletMsg(m => ({ ...m, [nodeId]: error.message })); return }
    setNodes(ns => ns.map(n => n.id === nodeId ? { ...n, trc20_address: addr || null } : n))
    setEditingWallet(null)
    setWalletMsg(m => ({ ...m, [nodeId]: '저장됐습니다' }))
    setTimeout(() => setWalletMsg(m => { const c = { ...m }; delete c[nodeId]; return c }), 2500)
  }

  const [pwOpen, setPwOpen]   = useState(false)
  const [pwCur, setPwCur]     = useState('')
  const [pwNew, setPwNew]     = useState('')
  const [pwConf, setPwConf]   = useState('')
  const [pwBusy, setPwBusy]   = useState(false)
  const [pwMsg, setPwMsg]     = useState('')
  const [pwErr, setPwErr]     = useState('')

  useEffect(() => {
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setAuthEmail(user.email ?? '')

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
    setPwErr(''); setPwMsg('')
    if (pwNew.length < 6)    { setPwErr('새 비밀번호는 6자 이상'); return }
    if (pwNew !== pwConf)     { setPwErr('비밀번호가 일치하지 않습니다'); return }
    setPwBusy(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) {
      const { error: e } = await supabase.auth.signInWithPassword({ email: user.email, password: pwCur })
      if (e) { setPwBusy(false); setPwErr('현재 비밀번호가 올바르지 않습니다'); return }
    }
    const { error } = await supabase.auth.updateUser({ password: pwNew })
    setPwBusy(false)
    if (error) { setPwErr(error.message); return }
    setPwMsg('변경 완료')
    setPwCur(''); setPwNew(''); setPwConf(''); setPwOpen(false)
    setTimeout(() => setPwMsg(''), 3000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
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
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 헤더 */}
          <div style={{ marginBottom: 4 }}>
            <h1 style={{ fontFamily: 'var(--font-main)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>내 프로필</h1>
          </div>

          {/* ── 개인 정보 카드 ── */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10, padding: '4px 20px 4px' }}>

            {/* 이름 */}
            <Row label="이름">
              {loading ? <Sk w={80} h={15} /> : <span style={{ fontFamily: 'var(--font-main)', fontSize: 14, fontWeight: 600 }}>{myProfile?.name}</span>}
            </Row>

            {/* 이메일 */}
            <Row label="이메일">
              {loading ? <Sk w={160} h={15} /> : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>{authEmail}</span>}
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
                      <input className="pf-input" type="password" value={val} onChange={e => set(e.target.value)} />
                    </div>
                  ))}
                  {pwErr && <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: '#f87171', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6 }}>{pwErr}</div>}
                  {pwMsg && <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: '#34d399' }}>{pwMsg}</div>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                    <button className="pf-btn pf-btn-primary" disabled={pwBusy} onClick={handlePwChange}>{pwBusy ? '변경 중...' : '변경 완료'}</button>
                    <button className="pf-btn pf-btn-ghost" onClick={() => { setPwOpen(false); setPwErr(''); setPwCur(''); setPwNew(''); setPwConf('') }}>취소</button>
                  </div>
                </div>
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
                const isEditing = editingWallet === n.id
                const msg = walletMsg[n.id]
                return (
                  <div key={n.id} style={{ background: 'var(--bg-inset)', border: `1px solid ${isMain ? nc + '33' : 'var(--border-primary)'}`, borderRadius: 8, overflow: 'hidden' }}>
                    {/* 노드 기본 정보 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: nc + '18', border: `1px solid ${nc}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: nc }}>
                        {n.rank}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                          <span style={{ fontFamily: 'var(--font-main)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{n.name}</span>
                          {isMain && <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: nc, background: nc + '18', border: `1px solid ${nc}33`, padding: '1px 6px', borderRadius: 3 }}>메인</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-blue)' }}>{n.node_id}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-tertiary)' }}>{n.ct_id}</span>
                        </div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{n.created_at.slice(0,10)}</span>
                    </div>

                    {/* TRC-20 지갑 주소 */}
                    <div style={{ borderTop: `1px solid ${isMain ? nc + '22' : 'var(--border-primary)'}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* 라벨 */}
                      <div style={{ flexShrink: 0 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>Binance Tether</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#34d399', letterSpacing: '0.06em' }}>TRC-20</div>
                      </div>
                      {isEditing ? (
                        <>
                          <input
                            className="pf-input"
                            value={walletInput}
                            onChange={e => { setWalletInput(e.target.value); setWalletMsg(m => { const c = { ...m }; delete c[n.id]; return c }) }}
                            placeholder="T로 시작하는 34자리 주소"
                            style={{ flex: 1, fontSize: 12, padding: '5px 10px', fontFamily: 'var(--font-mono)' }}
                            autoFocus
                          />
                          {msg && <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: '#f87171', flexShrink: 0 }}>{msg}</span>}
                          <button className="pf-btn pf-btn-primary" disabled={walletBusy} onClick={() => handleSaveWallet(n.id)} style={{ padding: '4px 10px', fontSize: 11 }}>저장</button>
                          <button className="pf-btn pf-btn-ghost" onClick={() => { setEditingWallet(null); setWalletMsg({}) }} style={{ padding: '4px 10px', fontSize: 11 }}>취소</button>
                        </>
                      ) : (
                        <>
                          {n.trc20_address ? (
                            <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {n.trc20_address.slice(0, 8)}…{n.trc20_address.slice(-6)}
                            </span>
                          ) : (
                            <span style={{ flex: 1, fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)' }}>미등록</span>
                          )}
                          {msg && <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: msg.includes('유효') ? '#f87171' : '#34d399', flexShrink: 0 }}>{msg}</span>}
                          <button className="pf-btn pf-btn-ghost" onClick={() => { setEditingWallet(n.id); setWalletInput(n.trc20_address ?? '') }} style={{ padding: '4px 10px', fontSize: 11, flexShrink: 0 }}>
                            {n.trc20_address ? '수정' : '등록'}
                          </button>
                        </>
                      )}
                    </div>

                    {/* MT5 계좌 번호 */}
                    {(() => {
                      const isMt5Editing = editingMt5 === n.id
                      const mt5m = mt5Msg[n.id]
                      return (
                        <div style={{ borderTop: `1px solid ${isMain ? nc + '22' : 'var(--border-primary)'}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flexShrink: 0 }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>MetaTrader 5</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#60a5fa', letterSpacing: '0.06em' }}>MT5</div>
                          </div>
                          {isMt5Editing ? (
                            <>
                              <input
                                className="pf-input"
                                value={mt5Input}
                                onChange={e => { setMt5Input(e.target.value.replace(/\D/g,'')); setMt5Msg(m => { const c = { ...m }; delete c[n.id]; return c }) }}
                                placeholder="5~12자리 숫자"
                                maxLength={12}
                                style={{ flex: 1, fontSize: 13, padding: '5px 10px', fontFamily: 'var(--font-mono)' }}
                                autoFocus
                              />
                              {mt5m && <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: '#f87171', flexShrink: 0 }}>{mt5m}</span>}
                              <button className="pf-btn pf-btn-primary" disabled={mt5Busy} onClick={() => handleSaveMt5(n.id)} style={{ padding: '4px 10px', fontSize: 11 }}>저장</button>
                              <button className="pf-btn pf-btn-ghost" onClick={() => { setEditingMt5(null); setMt5Msg({}) }} style={{ padding: '4px 10px', fontSize: 11 }}>취소</button>
                            </>
                          ) : (
                            <>
                              {n.mt5_account_id ? (
                                <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>{n.mt5_account_id}</span>
                              ) : (
                                <span style={{ flex: 1, fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)' }}>미등록</span>
                              )}
                              {mt5m && <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: mt5m.includes('자리') ? '#f87171' : '#34d399', flexShrink: 0 }}>{mt5m}</span>}
                              <button className="pf-btn pf-btn-ghost" onClick={() => { setEditingMt5(n.id); setMt5Input(n.mt5_account_id ?? '') }} style={{ padding: '4px 10px', fontSize: 11, flexShrink: 0 }}>
                                {n.mt5_account_id ? '수정' : '등록'}
                              </button>
                            </>
                          )}
                        </div>
                      )
                    })()}
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
