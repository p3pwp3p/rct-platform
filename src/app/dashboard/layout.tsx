'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import PageTransition from '@/components/PageTransition'
import { ProfileProvider, useProfile } from '@/lib/contexts/ProfileContext'
import { validateReferralCode } from '@/lib/db'
import type { Profile, SponsorInfo } from '@/lib/types'
import ThemeToggle from '@/components/ThemeToggle'

// ─── 상수 ─────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    section: 'NETWORK',
    items: [
      { href: '/dashboard',           label: '홈',       icon: 'home',  exact: true },
      { href: '/dashboard/tree',      label: '트리 뷰',  icon: 'tree' },
      { href: '/dashboard/analytics', label: '성과 분석', icon: 'chart' },
    ],
  },
  {
    section: 'ACCOUNT',
    items: [
      { href: '/dashboard/payouts',  label: '수당 내역', icon: 'payout' },
      { href: '/dashboard/receipts', label: '수령 현황', icon: 'coins' },
      { href: '/dashboard/profile',  label: '내 프로필', icon: 'user' },
    ],
  },
]

const PAGE_NAMES: Record<string, string> = {
  '/dashboard':              '홈',
  '/dashboard/tree':         '트리 뷰',
  '/dashboard/analytics':    '성과 분석',
  '/dashboard/payouts':      '수당 내역',
  '/dashboard/profile':      '내 프로필',
}

const RANK_COLOR: Record<string, string> = {
  'R0': '#64748b', 'R1': '#34d399', 'R2': '#60a5fa',
  'R3': '#fbbf24', 'R4': '#f97316', 'R5': '#a78bfa',
}

// ─── 아이콘 ──────────────────────────────────────────────────────────────────
function Icon({ name }: { name: string }) {
  const a = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'home':   return <svg {...a}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    case 'chart':  return <svg {...a}><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
    case 'user':   return <svg {...a}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    case 'tree':    return <svg {...a}><path d="M12 2v6M12 22v-6M12 8a4 4 0 0 1-4 4H4M12 8a4 4 0 0 0 4 4h4M12 16a4 4 0 0 1-4-4H4M12 16a4 4 0 0 0 4-4h4"/></svg>
    // 후원 바이너리 트리 (L/R 분기)
    case 'binary':  return <svg {...a}><line x1="12" y1="3" x2="12" y2="8"/><path d="M5 8h14"/><line x1="5" y1="8" x2="5" y2="14"/><line x1="19" y1="8" x2="19" y2="14"/><path d="M2 14h6"/><path d="M16 14h6"/></svg>
    // 추천 트리 (여러 갈래)
    case 'referral': return <svg {...a}><circle cx="12" cy="5" r="2"/><line x1="12" y1="7" x2="12" y2="11"/><path d="M12 11 L6 16 M12 11 L12 16 M12 11 L18 16"/><circle cx="6" cy="18" r="2"/><circle cx="12" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>
    case 'logout': return <svg {...a}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
    case 'plus':   return <svg {...a}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    case 'payout': return <svg {...a}><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
    case 'coins':  return <svg {...a}><ellipse cx="8" cy="6" rx="6" ry="3"/><path d="M2 6v6c0 1.66 2.69 3 6 3s6-1.34 6-3V6"/><path d="M14 11.5c.6.3 1.3.5 2 .5 3.31 0 6-1.34 6-3V9c0-1.66-2.69-3-6-3"/></svg>
    default: return null
  }
}

// ─── 계정 스위처 ─────────────────────────────────────────────────────────────
function AccountSwitcher() {
  const { profiles, activeProfile, setActiveProfileId, loading } = useProfile()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const rc           = RANK_COLOR[activeProfile?.rank ?? 'R0']
  const hasMultiple  = profiles.length > 1

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => hasMultiple && setOpen(o => !o)}
        disabled={loading}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%',
          padding: '7px 10px',
          background: 'var(--bg-inset)',
          border: `1px solid ${open ? rc + '66' : 'var(--border-primary)'}`,
          borderRadius: 6,
          cursor: hasMultiple ? 'pointer' : 'default',
          transition: 'border-color 0.15s',
          outline: 'none', minWidth: 0,
        }}
        onMouseEnter={e => { if (hasMultiple) (e.currentTarget as HTMLElement).style.borderColor = rc + '66' }}
        onMouseLeave={e => { if (!open) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-primary)' }}
      >
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: loading ? 'var(--border-secondary)' : rc, boxShadow: loading ? 'none' : `0 0 5px ${rc}88`, flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
          {loading ? '—' : (activeProfile?.node_id ?? '—')}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10, fontWeight: 700, color: rc,
          background: rc + '18', border: `1px solid ${rc}44`,
          padding: '1px 6px', borderRadius: 4, whiteSpace: 'nowrap',
        }}>
          {loading ? '···' : (activeProfile?.rank ?? 'R0')}
        </span>
        {hasMultiple && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        )}
      </button>

      {/* 드롭다운 */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          minWidth: 0, zIndex: 200,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-primary)',
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          animation: 'dropIn 0.15s ease',
        }}>
          <style>{`@keyframes dropIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }`}</style>

          <div style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-primary)' }}>
            My Accounts ({profiles.length})
          </div>

          {profiles.map((p: Profile) => {
            const prc      = RANK_COLOR[p.rank]
            const isActive = p.id === activeProfile?.id
            return (
              <button
                key={p.id}
                onClick={() => { setActiveProfileId(p.id); setOpen(false) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  background: isActive ? prc + '0d' : 'transparent',
                  border: 'none', borderBottom: '1px solid var(--border-primary)',
                  cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                  background: prc + '18', border: `1px solid ${prc}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11, fontWeight: 700, color: prc,
                }}>
                  {p.rank}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{p.node_id}</div>
                </div>
                {isActive && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={prc} strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── 코드 입력 인풋 (공용) ──────────────────────────────────────────────────
function CodeInput({ value, onChange, onEnter, accentColor = '#a78bfa' }: {
  value: string; onChange: (v: string) => void; onEnter?: () => void; accentColor?: string
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
      onKeyDown={e => e.key === 'Enter' && onEnter?.()}
      maxLength={8}
      placeholder="XXXXXXXX"
      style={{
        width: '100%', padding: '10px 14px', boxSizing: 'border-box',
        background: 'var(--bg-inset)', border: '1px solid var(--border-secondary)',
        borderRadius: 6, color: 'var(--text-primary)',
        fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700,
        letterSpacing: '0.18em', outline: 'none', textAlign: 'center',
      }}
      onFocus={e => (e.currentTarget.style.borderColor = accentColor + '88')}
      onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-secondary)')}
      autoFocus
    />
  )
}

// ─── 확인된 멤버 카드 ────────────────────────────────────────────────────────
function MemberCard({ info, label }: { info: SponsorInfo; label: string }) {
  const rc = RANK_COLOR[info.rank]
  return (
    <div style={{ padding: '11px 14px', background: 'var(--bg-inset)', border: '1px solid var(--border-primary)', borderRadius: 8 }}>
      <div style={{ fontFamily: 'var(--font-main)', fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 8, whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 6, flexShrink: 0,
          background: rc + '18', border: `1px solid ${rc}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 11, fontWeight: 700, color: rc,
        }}>
          {info.rank}
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{info.node_id}</div>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)' }}>{info.name}</div>
        </div>
      </div>
    </div>
  )
}

// ─── 노드 추가 모달 (3단계) ──────────────────────────────────────────────────
// Step 1: 후원인 코드 입력  (트리 배치 결정 — parent_id + leg_position)
// Step 2: 추천인 코드 입력  (실적/커미션 귀속 — referrer_id)
// Step 3: 이름 + 레그 선택 → 등록
function AddNodeModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  type Step = 'sponsor' | 'referrer' | 'detail' | 'done'
  const [step, setStep]         = useState<Step>('sponsor')

  // 후원인
  const [sponsorCode, setSponsorCode]   = useState('')
  const [sponsor, setSponsor]           = useState<SponsorInfo | null>(null)

  // 추천인
  const [referrerCode, setReferrerCode] = useState('')
  const [referrer, setReferrer]         = useState<SponsorInfo | null>(null)

  // 상세
  const [name, setName]       = useState('')
  const [mt5Id, setMt5Id]     = useState('')
  const [leg, setLeg]         = useState<'LEFT' | 'RIGHT' | null>(null)

  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')

  const STEPS: Record<Step, string> = {
    sponsor: 'Step 1 / 3', referrer: 'Step 2 / 3', detail: 'Step 3 / 3', done: 'Complete',
  }
  const TITLES: Record<Step, string> = {
    sponsor: '후원인 코드 입력', referrer: '추천인 코드 입력', detail: '노드 상세 설정', done: '노드 추가 완료',
  }

  // 코드 확인 공통
  const checkCode = async (code: string, onOk: (info: SponsorInfo) => void) => {
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length !== 8) { setError('코드는 8자리입니다.'); return }
    setBusy(true); setError('')
    try {
      const info = await validateReferralCode(trimmed)
      if (!info) { setError('존재하지 않는 코드입니다.'); return }
      onOk(info)
    } catch {
      setError('코드 확인 중 오류가 발생했습니다.')
    } finally {
      setBusy(false)
    }
  }

  // 후원인 확인
  const handleSponsorCheck = () =>
    checkCode(sponsorCode, info => { setSponsor(info); setStep('referrer') })

  // 추천인 확인
  const handleReferrerCheck = () =>
    checkCode(referrerCode, info => { setReferrer(info); setStep('detail') })

  // 등록
  const handleSubmit = async () => {
    if (!leg)           { setError('레그를 선택해주세요.'); return }
    if (!name.trim())   { setError('이름을 입력해주세요.'); return }
    if (!mt5Id.trim())  { setError('MT5 계좌 번호를 입력해주세요.'); return }
    setBusy(true); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('로그인이 필요합니다.')

      const res  = await fetch('/api/add-node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:          name.trim(),
          sponsorCode:   sponsorCode.trim().toUpperCase(),
          referrerCode:  referrerCode.trim().toUpperCase(),
          leg,
          mt5AccountId:  mt5Id.trim(),
          accessToken:   session.access_token,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '노드 추가 실패')

      setStep('done')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setBusy(false)
    }
  }

  // 스텝 바 진행도
  const stepIdx = { sponsor: 0, referrer: 1, detail: 2, done: 3 }[step]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: 'min(440px, calc(100vw - 32px))', background: 'var(--bg-surface)',
        border: '1px solid var(--border-primary)',
        borderRadius: 12, overflow: 'hidden',
        animation: 'modalPop 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      }}>

        {/* 헤더 */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 3 }}>
              {STEPS[step]}
            </div>
            <div style={{ fontFamily: 'var(--font-main)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              {TITLES[step]}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, border: 'none', background: 'rgba(255,255,255,0.04)', borderRadius: 5, cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* 스텝 프로그레스 바 */}
        {step !== 'done' && (
          <div style={{ display: 'flex', height: 2, background: 'var(--bg-inset)' }}>
            <div style={{
              height: '100%',
              width: `${(stepIdx / 3) * 100}%`,
              background: 'var(--accent-blue)',
              transition: 'width 0.3s ease',
            }} />
          </div>
        )}

        <div style={{ padding: '24px 20px' }}>

          {/* ── Step 1: 후원인 코드 ── */}
          {step === 'sponsor' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6, padding: '10px 14px', background: 'var(--bg-inset)', borderRadius: 7, border: '1px solid var(--border-primary)' }}>
                <strong style={{ color: 'var(--accent-blue)' }}>후원인</strong>은 내가 트리에서 배치될 위치를 결정합니다.<br/>
                후원인의 레프트 또는 라이트 레그에 등록됩니다.
              </div>
              <div>
                <label style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                  후원인 추천 코드
                </label>
                <CodeInput
                  value={sponsorCode}
                  onChange={v => { setSponsorCode(v); setError('') }}
                  onEnter={handleSponsorCheck}
                  accentColor="var(--accent-blue)"
                />
              </div>
              {error && <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: '#f87171', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6 }}>{error}</div>}
              <button onClick={handleSponsorCheck} disabled={busy || sponsorCode.length < 8}
                style={{ width: '100%', padding: '11px', borderRadius: 7, border: 'none', background: sponsorCode.length === 8 ? 'var(--accent-blue)' : 'var(--bg-inset)', color: sponsorCode.length === 8 ? '#000' : 'var(--text-tertiary)', fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 700, cursor: sponsorCode.length === 8 ? 'pointer' : 'not-allowed', opacity: busy ? 0.6 : 1, transition: 'all 0.15s' }}>
                {busy ? '확인 중...' : '다음 →'}
              </button>
            </div>
          )}

          {/* ── Step 2: 추천인 코드 ── */}
          {step === 'referrer' && sponsor && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <MemberCard info={sponsor} label="후원인" />
              <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6, padding: '10px 14px', background: 'var(--bg-inset)', borderRadius: 7, border: '1px solid var(--border-primary)' }}>
                <strong style={{ color: '#a78bfa' }}>추천인</strong>은 나를 직접 소개한 사람입니다.<br/>
                후원인과 다를 수 있으며, 실적 커미션이 귀속됩니다.
              </div>
              <div>
                <label style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                  추천인 추천 코드
                </label>
                <CodeInput
                  value={referrerCode}
                  onChange={v => { setReferrerCode(v); setError('') }}
                  onEnter={handleReferrerCheck}
                  accentColor="#a78bfa"
                />
              </div>
              {error && <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: '#f87171', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setStep('sponsor'); setSponsor(null); setError('') }}
                  style={{ flex: 1, padding: '11px', borderRadius: 7, border: '1px solid var(--border-secondary)', background: 'transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-main)', fontSize: 13, cursor: 'pointer' }}>
                  ← 이전
                </button>
                <button onClick={handleReferrerCheck} disabled={busy || referrerCode.length < 8}
                  style={{ flex: 2, padding: '11px', borderRadius: 7, border: 'none', background: referrerCode.length === 8 ? '#a78bfa' : 'var(--bg-inset)', color: referrerCode.length === 8 ? '#000' : 'var(--text-tertiary)', fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 700, cursor: referrerCode.length === 8 ? 'pointer' : 'not-allowed', opacity: busy ? 0.6 : 1, transition: 'all 0.15s' }}>
                  {busy ? '확인 중...' : '다음 →'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: 이름 + 레그 ── */}
          {step === 'detail' && sponsor && referrer && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* 요약 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <MemberCard info={sponsor}  label="후원인" />
                <MemberCard info={referrer} label="추천인" />
              </div>

              {/* 이름 */}
              <div>
                <label style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>이름</label>
                <input
                  value={name}
                  onChange={e => { setName(e.target.value); setError('') }}
                  placeholder="이 노드의 이름"
                  autoFocus
                  style={{
                    width: '100%', padding: '9px 12px', boxSizing: 'border-box',
                    background: 'var(--bg-inset)', border: '1px solid var(--border-secondary)',
                    borderRadius: 6, color: 'var(--text-primary)',
                    fontFamily: 'var(--font-main)', fontSize: 13, outline: 'none',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent-blue)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-secondary)')}
                />
              </div>

              {/* MT5 계좌 ID */}
              <div>
                <label style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>MT5 계좌 번호</label>
                <input
                  value={mt5Id}
                  onChange={e => { setMt5Id(e.target.value.replace(/\D/g, '')); setError('') }}
                  placeholder="MT5 계좌 번호"
                  maxLength={12}
                  style={{
                    width: '100%', padding: '9px 12px', boxSizing: 'border-box',
                    background: 'var(--bg-inset)', border: '1px solid var(--border-secondary)',
                    borderRadius: 6, color: 'var(--text-primary)',
                    fontFamily: 'var(--font-main)', fontSize: 13, outline: 'none',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#60a5fa')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-secondary)')}
                />
              </div>

              {/* 레그 선택 */}
              <div>
                <label style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                  후원인 레그 위치
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {(['LEFT', 'RIGHT'] as const).map(side => {
                    const taken    = side === 'LEFT' ? sponsor.left_taken : sponsor.right_taken
                    const legColor = side === 'LEFT' ? '#60a5fa' : '#a78bfa'
                    const active   = leg === side
                    return (
                      <button key={side} disabled={taken} onClick={() => { setLeg(side); setError('') }}
                        style={{
                          padding: '14px', borderRadius: 7,
                          background: active ? legColor + '18' : 'var(--bg-inset)',
                          border: `1px solid ${active ? legColor : taken ? 'var(--border-primary)' : 'var(--border-secondary)'}`,
                          color: taken ? 'var(--text-tertiary)' : active ? legColor : 'var(--text-secondary)',
                          cursor: taken ? 'not-allowed' : 'pointer',
                          fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                          transition: 'all 0.15s', opacity: taken ? 0.4 : 1,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        }}>
                        {side}
                        {taken
                          ? <span style={{ fontFamily: 'var(--font-main)', fontSize: 10, fontWeight: 400 }}>점유됨</span>
                          : <span style={{ fontFamily: 'var(--font-main)', fontSize: 10, fontWeight: 400, color: legColor + 'aa' }}>선택 가능</span>
                        }
                      </button>
                    )
                  })}
                </div>
              </div>

              {error && <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: '#f87171', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setStep('referrer'); setReferrer(null); setError('') }}
                  style={{ flex: 1, padding: '11px', borderRadius: 7, border: '1px solid var(--border-secondary)', background: 'transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-main)', fontSize: 13, cursor: 'pointer' }}>
                  ← 이전
                </button>
                <button onClick={handleSubmit} disabled={busy || !leg || !name.trim() || !mt5Id.trim()}
                  style={{ flex: 2, padding: '11px', borderRadius: 7, border: 'none', background: leg && name.trim() && mt5Id.trim() ? 'var(--accent-blue)' : 'var(--bg-inset)', color: leg && name.trim() && mt5Id.trim() ? '#000' : 'var(--text-tertiary)', fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 700, cursor: leg && name.trim() && mt5Id.trim() ? 'pointer' : 'not-allowed', opacity: busy ? 0.6 : 1, transition: 'all 0.15s' }}>
                  {busy ? '등록 중...' : '노드 추가'}
                </button>
              </div>
            </div>
          )}

          {/* ── Done ── */}
          {step === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '12px 0' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(52,211,153,0.12)', border: '2px solid rgba(52,211,153,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-main)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>노드가 추가됐습니다</div>
                <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)' }}>좌측 사이드바 계좌 선택에서 전환할 수 있습니다.</div>
              </div>
              <button onClick={() => { onSuccess(); onClose() }}
                style={{ width: '100%', padding: '11px', borderRadius: 7, border: 'none', background: 'var(--accent-blue)', color: '#000', fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                확인
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Vantage 가입 안내 모달 (계정당 1회) ──────────────────────────────────────
// 노드 추가 전 1회 노출. 예/아니오 중 하나라도 선택하면 vantage_ack=true 로 저장되어
// 이후 다시 표시되지 않음.
function VantageWarningModal({ busy, onProceed, onDismiss }: {
  busy: boolean
  onProceed: () => void   // 예 → ack 저장 후 노드 추가 진행
  onDismiss: () => void   // 아니오 → ack 저장 후 닫기
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 'min(440px, calc(100vw - 32px))', background: 'var(--bg-surface)',
        border: '1px solid var(--border-primary)',
        borderRadius: 12, overflow: 'hidden',
        animation: 'modalPop 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {/* 헤더 */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 9 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            Vantage 선물사 가입 안내
          </div>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            노드를 등록하려면 <strong>Vantage 선물 계좌</strong>가 있어야 합니다.<br/>
            상위 스폰서의 <strong>IB 추천코드</strong>가 있으면 그 코드로 가입하시고,
            없다면 아래 링크로 가입해 주세요.
          </div>

          <a href="https://vigco.co/la-com-inv/2l6qPx7E" target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 12px', borderRadius: 7, background: '#f59e0b', color: '#1a1206', fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            Vantage 추천코드로 가입하기
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M7 7h10v10"/></svg>
          </a>

          <a href="https://accounts.binance.com/register" target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 12px', borderRadius: 7, background: 'transparent', border: '1px solid #f0b90b', color: '#f0b90b', fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            바이낸스 가입하기
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M7 7h10v10"/></svg>
          </a>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '11px 13px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, fontFamily: 'var(--font-main)', fontSize: 12, color: '#f87171', lineHeight: 1.6 }}>
            <span style={{ flexShrink: 0, fontWeight: 700 }}>⚠</span>
            <span>가입 시 입력한 <strong>IB 코드는 이후 변경이 불가능</strong>합니다. 신중히 확인 후 가입하세요. 이 안내는 한 번만 표시됩니다.</span>
          </div>

          {/* 예 / 아니오 */}
          <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
            <button onClick={onDismiss} disabled={busy}
              style={{ flex: 1, padding: '11px', borderRadius: 7, border: '1px solid var(--border-primary)', background: 'var(--bg-inset)', color: 'var(--text-secondary)', fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
              아니오
            </button>
            <button onClick={onProceed} disabled={busy}
              style={{ flex: 1, padding: '11px', borderRadius: 7, border: 'none', background: 'var(--accent-blue)', color: '#000', fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
              {busy ? '처리 중...' : '예, 노드 추가'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 내부 레이아웃 ────────────────────────────────────────────────────────────
function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const { activeProfile, refresh, loading: profileLoading, profiles } = useProfile()
  const [showAddModal, setShowAddModal] = useState(false)
  const [showVantageWarn, setShowVantageWarn] = useState(false)
  const [vantageBusy, setVantageBusy] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // 라우트 이동 시 모바일 드로어 자동 닫기
  useEffect(() => { setMobileNavOpen(false) }, [pathname])

  // vantage_ack은 auth 유저(계정) 단위. 유저가 소유한 프로필 중 하나라도 ack면 확인 완료로 간주.
  const vantageAcked = profiles.some(p => p.vantage_ack)

  // 노드 추가 클릭 — ack 안 된 계정이면 Vantage 안내 먼저, 아니면 바로 추가
  const handleAddNodeClick = () => {
    if (vantageAcked) setShowAddModal(true)
    else setShowVantageWarn(true)
  }

  // 예/아니오 어느 쪽이든 ack 저장 → 이후 안내 미표시 (계정 단위, service-role 라우트로 기록)
  const ackVantage = async (proceed: boolean) => {
    setVantageBusy(true)
    try {
      if (!vantageAcked) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await fetch('/api/vantage-ack', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: session.access_token }),
          })
          await refresh()
        }
      }
    } finally {
      setVantageBusy(false)
      setShowVantageWarn(false)
      if (proceed) setShowAddModal(true)
    }
  }

  // 인증 가드
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error || !user) { supabase.auth.signOut(); router.replace('/login'); return }
      if (user.app_metadata?.role === 'admin') { router.replace('/admin'); return }
    })

    // 토큰 만료 / 리프레시 실패 시 자동 로그아웃
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        if (event === 'SIGNED_OUT') router.replace('/login')
      }
    })
    return () => subscription.unsubscribe()
  }, [router])

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  const currentPageName = PAGE_NAMES[pathname] ?? '대시보드'

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      <style>{`
        .layout-nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 16px;
          font-family: var(--font-main); font-size: 13px;
          color: var(--text-secondary);
          text-decoration: none; cursor: pointer;
          transition: background 0.15s;
          border-left: 2px solid transparent;
        }
        .layout-nav-item:hover { background: rgba(148,163,184,0.05); }
        .layout-nav-item.active {
          background: var(--accent-blue-dim);
          color: var(--accent-blue);
          border-left-color: var(--accent-blue);
        }
        .layout-logout-btn {
          display: flex; align-items: center; gap: 10px;
          width: 100%; padding: 10px 16px;
          font-family: var(--font-main); font-size: 13px;
          color: var(--text-tertiary);
          background: none; border: none; cursor: pointer;
          text-align: left; transition: background 0.15s;
        }
        .layout-logout-btn:hover { background: rgba(148,163,184,0.05); color: var(--text-secondary); }
        .add-node-btn {
          display: flex; align-items: center; gap: 10px;
          width: 100%; padding: 10px 16px;
          font-family: var(--font-main); font-size: 13px;
          color: var(--accent-blue);
          background: none; border: none; cursor: pointer;
          text-align: left;
          border-left: 2px solid transparent;
          transition: background 0.15s, border-color 0.15s;
        }
        .add-node-btn:hover {
          background: var(--accent-blue-dim);
          border-left-color: var(--accent-blue);
        }
        /* 햄버거: 데스크톱 숨김, 모바일 표시 */
        .dash-hamburger { display: none; }
        .dash-overlay { display: none; }
        @media (max-width: 768px) {
          .dash-hamburger {
            display: flex; align-items: center; justify-content: center;
            width: 32px; height: 32px; flex-shrink: 0;
            background: none; border: none; cursor: pointer;
            color: var(--text-secondary); padding: 0; margin-right: 2px;
          }
          /* 본문 그리드를 단일 컬럼으로 */
          .dash-body { grid-template-columns: 1fr !important; }
          /* 사이드바를 슬라이드 드로어로 */
          .dash-sidebar {
            position: fixed !important;
            top: 48px; left: 0; bottom: 0;
            width: 240px; z-index: 120;
            transform: translateX(-100%);
            transition: transform 0.22s ease;
            box-shadow: 0 0 32px rgba(0,0,0,0.5);
          }
          .dash-sidebar.open { transform: translateX(0); }
          /* 드로어 뒤 어둡게 */
          .dash-overlay {
            display: block;
            position: fixed; inset: 48px 0 0 0; z-index: 110;
            background: rgba(0,0,0,0.5);
            animation: overlayFade 0.2s ease;
          }
          @keyframes overlayFade { from { opacity: 0 } to { opacity: 1 } }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>

        {/* ── 상단 네비게이션 ── */}
        <div style={{
          height: 48, flexShrink: 0,
          display: 'flex', alignItems: 'center',
          padding: '0 20px', gap: 12,
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-primary)',
        }}>
          <button className="dash-hamburger" onClick={() => setMobileNavOpen(o => !o)} aria-label="메뉴">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>
            RCT Platform
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-secondary)' }}>
            {currentPageName}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <ThemeToggle />
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 8px',
              border: '1px solid var(--accent-blue)', borderRadius: 4, color: 'var(--accent-blue)',
              letterSpacing: '0.08em',
            }}>LIVE</span>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--accent-blue-dim)', border: '1px solid var(--accent-blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-blue)',
            }}>
              {activeProfile?.node_id?.slice(-2) ?? 'U'}
            </div>
          </div>
        </div>

        {/* ── 바디 ── */}
        <div className="dash-body" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', flex: 1, overflow: 'hidden', position: 'relative' }}>

          {/* 모바일 드로어 오버레이 */}
          {mobileNavOpen && <div className="dash-overlay" onClick={() => setMobileNavOpen(false)} />}

          {/* Left Sidebar */}
          <aside className={`dash-sidebar${mobileNavOpen ? ' open' : ''}`} style={{
            background: 'var(--bg-surface)',
            borderRight: '1px solid var(--border-primary)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* ── 계정 스위처 ── */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-primary)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                Active Account
              </div>
              <AccountSwitcher />
            </div>

            <nav style={{ flex: 1, overflowY: 'auto', paddingTop: 8 }}>
              {NAV_ITEMS.map(section => (
                <div key={section.section}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.14em',
                    color: 'var(--text-secondary)',
                    padding: '16px 16px 6px',
                  }}>
                    {section.section}
                  </div>
                  {section.items.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`layout-nav-item${isActive(item.href, item.exact) ? ' active' : ''}`}
                    >
                      <Icon name={item.icon} />
                      {item.label}
                    </Link>
                  ))}
                </div>
              ))}

              {/* ── 노드 추가 버튼 ── */}
              <div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.14em',
                  color: 'var(--text-secondary)',
                  padding: '16px 16px 6px',
                }}>
                  MANAGE
                </div>
                <button
                  className="add-node-btn"
                  onClick={handleAddNodeClick}
                >
                  <Icon name="plus" />
                  노드 추가
                </button>
              </div>
            </nav>

            {/* Logout */}
            <div style={{ borderTop: '1px solid var(--border-primary)' }}>
              <button className="layout-logout-btn" onClick={handleLogout}>
                <Icon name="logout" />
                로그아웃
              </button>
            </div>
          </aside>

          {/* Page content */}
          <PageTransition>
            {children}
          </PageTransition>
        </div>
      </div>

      {/* Vantage 가입 안내 (계정당 1회) */}
      {showVantageWarn && (
        <VantageWarningModal
          busy={vantageBusy}
          onProceed={() => ackVantage(true)}
          onDismiss={() => ackVantage(false)}
        />
      )}

      {/* 노드 추가 모달 */}
      {showAddModal && (
        <AddNodeModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => refresh()}
        />
      )}
    </>
  )
}

// ─── export ──────────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProfileProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </ProfileProvider>
  )
}
