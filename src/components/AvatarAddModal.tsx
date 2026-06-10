'use client'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

// ── 추천 코드 → 후원인 정보 목업 ────────────────────────────────────────────
const SPONSOR_DB: Record<string, { id: string; rank: string }> = {
  'A3K9P2MQ': { id: 'RCT-00125', rank: 'R3' },
  'BX71MQZR': { id: 'RCT-00126', rank: 'R2' },
  'ZQ8N4RPK': { id: 'RCT-00127', rank: 'R1' },
  'N7TK3VYH': { id: 'RCT-00124', rank: 'R4' },
}

const RANK_COLOR: Record<string, string> = {
  'R0': '#64748b', 'R1': '#34d399', 'R2': '#60a5fa',
  'R3': '#a78bfa',     'R4': '#f97316', 'R5': '#a78bfa',
}

// 6자리 랜덤 추천 코드 생성
function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

type Step = 'code' | 'ct' | 'confirm' | 'done'
const STEPS: Step[] = ['code', 'ct', 'confirm']
const STEP_LABELS = ['추천 코드', 'CT 계정', '등록 확인']

interface FormData {
  referralCode: string
  ctAccount: string
}

export default function AvatarAddModal({ onClose }: { onClose: () => void }) {
  const [step, setStep]       = useState<Step>('code')
  const [form, setForm]       = useState<FormData>({ referralCode: '', ctAccount: '' })
  const [codeState, setCodeState] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle')
  const [sponsor, setSponsor] = useState<{ id: string; rank: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [myCode]              = useState(genCode)   // 이 아바타에 발급되는 고유 추천 코드

  const stepIdx  = STEPS.indexOf(step)
  const progress = step === 'done' ? 100 : Math.round((stepIdx / (STEPS.length - 1)) * 100)

  // 추천 코드 실시간 검증 (300ms debounce)
  useEffect(() => {
    const code = form.referralCode.toUpperCase().trim()
    if (code.length < 8) { setCodeState('idle'); setSponsor(null); return }
    setCodeState('checking')
    const t = setTimeout(() => {
      const found = SPONSOR_DB[code]
      if (found) { setCodeState('valid'); setSponsor(found) }
      else        { setCodeState('invalid'); setSponsor(null) }
    }, 400)
    return () => clearTimeout(t)
  }, [form.referralCode])

  const handleSubmit = async () => {
    setSubmitting(true)
    await new Promise(r => setTimeout(r, 900))
    setSubmitting(false)
    setStep('done')
  }

  /* ── 공통 스타일 ── */
  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(10,12,16,0.8)',
    border: '1px solid #242a35', color: '#e0e6ed',
    padding: '12px 16px', borderRadius: 4, fontSize: 15,
    outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }

  const content = (
    <>
      <style>{`
        @keyframes modalPop {
          0%   { opacity: 0; transform: scale(0.96) translateY(10px); filter: blur(4px); }
          100% { opacity: 1; transform: scale(1)    translateY(0);    filter: blur(0); }
        }
        @keyframes stepIn {
          0%   { opacity: 0; transform: translateX(18px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }

        .av-input:focus { border-color: #4db6ac !important; box-shadow: 0 0 0 3px rgba(77,182,172,0.08); }
        .av-input::placeholder { color: #64748b; }
        .av-input.valid   { border-color: rgba(52,211,153,0.5) !important; }
        .av-input.invalid { border-color: rgba(248,113,113,0.5) !important; }

        .av-btn-primary {
          width: 100%; padding: 14px;
          background: #4db6ac; color: #07080a;
          border: none; border-radius: 4px;
          font-family: var(--font-main); font-size: 15px; font-weight: 700;
          cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .av-btn-primary:hover:not(:disabled) {
          background: #5ec8be; transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(77,182,172,0.2);
        }
        .av-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none !important; }

        .av-btn-ghost {
          padding: 13px 18px;
          background: transparent; color: var(--text-secondary);
          border: 1px solid var(--border-secondary); border-radius: 4px;
          font-family: var(--font-main); font-size: 14px;
          cursor: pointer; transition: all 0.2s; white-space: nowrap;
        }
        .av-btn-ghost:hover { border-color: var(--text-secondary); color: var(--text-primary); }

        .av-spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(7,8,10,0.3); border-top-color: #07080a;
          border-radius: 50%; animation: spin 0.7s linear infinite;
        }
        .av-field label {
          display: block; font-size: 13px; font-weight: 600;
          font-family: var(--font-main); color: var(--text-secondary); margin-bottom: 8px;
        }
        .av-field .hint { font-size: 12px; color: var(--text-tertiary); margin-top: 6px; line-height: 1.5; }

        .code-checking { animation: pulse 0.8s ease infinite; }
      `}</style>

      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(7,8,10,0.8)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          width: 460,
          animation: 'modalPop 0.32s cubic-bezier(0.16,1,0.3,1) both',
        }}>
          <div style={{
            background: 'rgba(17,20,27,0.98)',
            border: '1px solid #242a35', borderRadius: 8, overflow: 'hidden',
            boxShadow: '0 40px 100px rgba(0,0,0,0.7)',
          }}>

            {/* Header */}
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid #242a35',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, marginBottom: 5 }}>
                  레그 등록
                </div>
                <div style={{ fontFamily: 'var(--font-main)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {step === 'done' ? '등록 완료' : '새 레그 신청'}
                </div>
              </div>
              <button onClick={onClose} style={{
                width: 30, height: 30, border: 'none',
                background: 'rgba(255,255,255,0.04)', borderRadius: 4, cursor: 'pointer',
                color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Progress */}
            {step !== 'done' && (
              <>
                <div style={{ height: 2, background: '#1a1e26' }}>
                  <div style={{
                    height: '100%', background: 'var(--accent-blue)',
                    width: `${progress}%`, transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
                  }} />
                </div>
                <div style={{ padding: '14px 24px 0', display: 'flex', gap: 6 }}>
                  {STEP_LABELS.map((label, i) => (
                    <div key={i} style={{ flex: 1 }}>
                      <div style={{
                        height: 2, borderRadius: 1, marginBottom: 5,
                        background: i <= stepIdx ? 'var(--accent-blue)' : 'var(--border-primary)',
                        transition: 'background 0.3s',
                      }} />
                      <div style={{
                        fontSize: 12, fontFamily: 'var(--font-main)', fontWeight: 600,
                        color: i === stepIdx ? 'var(--accent-blue)'
                             : i < stepIdx  ? 'var(--text-secondary)'
                             : 'var(--text-tertiary)',
                      }}>{label}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Body */}
            <div style={{ padding: 24 }}>

              {/* ── Step 1: 추천 코드 ── */}
              {step === 'code' && (
                <div style={{ animation: 'stepIn 0.22s ease both', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                    후원인에게 받은 <strong style={{ color: 'var(--text-primary)' }}>추천 코드</strong>를 입력하세요.
                    코드 확인 후 즉시 네트워크에 등록됩니다.
                  </p>

                  <div className="av-field">
                    <label>추천 코드</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        className={`av-input${codeState === 'valid' ? ' valid' : codeState === 'invalid' ? ' invalid' : ''}`}
                        style={{
                          ...inputStyle,
                          fontFamily: 'var(--font-mono)', letterSpacing: '0.12em',
                          fontSize: 18, textTransform: 'uppercase', paddingRight: 44,
                        }}
                        placeholder="A3K9P2MQ"
                        maxLength={8}
                        value={form.referralCode}
                        onChange={e => setForm(f => ({ ...f, referralCode: e.target.value.toUpperCase() }))}
                      />
                      {/* 상태 아이콘 */}
                      <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }}>
                        {codeState === 'checking' && (
                          <div style={{ width: 16, height: 16, border: '2px solid #4db6ac33', borderTop: '2px solid #4db6ac', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                        )}
                        {codeState === 'valid' && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                        {codeState === 'invalid' && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        )}
                      </div>
                    </div>
                    {codeState === 'invalid' && (
                      <div className="hint" style={{ color: '#f87171' }}>유효하지 않은 추천 코드입니다.</div>
                    )}
                  </div>

                  {/* 후원인 확인 카드 */}
                  {codeState === 'valid' && sponsor && (
                    <div style={{
                      padding: '12px 14px',
                      background: 'rgba(52,211,153,0.04)',
                      border: '1px solid rgba(52,211,153,0.2)',
                      borderRadius: 6, display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                      <div>
                        <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 3 }}>후원인 확인됨</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent-blue)' }}>{sponsor.id}</span>
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                            color: RANK_COLOR[sponsor.rank] ?? '#64748b',
                            background: `${RANK_COLOR[sponsor.rank] ?? '#64748b'}18`,
                            border: `1px solid ${RANK_COLOR[sponsor.rank] ?? '#64748b'}44`,
                            padding: '1px 6px', borderRadius: 4,
                          }}>{sponsor.rank}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    className="av-btn-primary"
                    disabled={codeState !== 'valid'}
                    onClick={() => setStep('ct')}
                  >
                    다음 단계 →
                  </button>
                </div>
              )}

              {/* ── Step 2: CT 계정 ── */}
              {step === 'ct' && (
                <div style={{ animation: 'stepIn 0.22s ease both', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                    등록할 <strong style={{ color: 'var(--text-primary)' }}>CT 계정 번호</strong>를 입력하세요.
                    이 계정이 새 레그로 즉시 활성화됩니다.
                  </p>

                  <div className="av-field">
                    <label>CT 계정 번호 (MT5)</label>
                    <input
                      className="av-input"
                      style={{ ...inputStyle, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
                      placeholder="예: 1234567"
                      value={form.ctAccount}
                      onChange={e => setForm(f => ({ ...f, ctAccount: e.target.value }))}
                    />
                    <div className="hint">MT5 플랫폼에서 확인할 수 있는 계정 번호입니다.</div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="av-btn-ghost" onClick={() => setStep('code')}>← 이전</button>
                    <button
                      className="av-btn-primary"
                      style={{ flex: 1 }}
                      disabled={!form.ctAccount.trim()}
                      onClick={() => setStep('confirm')}
                    >
                      다음 단계 →
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step 3: 등록 확인 ── */}
              {step === 'confirm' && (
                <div style={{ animation: 'stepIn 0.22s ease both' }}>
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
                    아래 내용을 확인 후 등록을 완료하세요. 제출 즉시 네트워크에 반영됩니다.
                  </p>

                  <div style={{
                    background: 'var(--bg-inset)', border: '1px solid var(--border-secondary)',
                    borderRadius: 6, overflow: 'hidden', marginBottom: 16,
                  }}>
                    {[
                      { label: '추천 코드',  value: form.referralCode.toUpperCase(), mono: true },
                      { label: '후원인 노드', value: sponsor?.id ?? '-', mono: true },
                      { label: 'CT 계정',    value: form.ctAccount, mono: true },
                      { label: '내 추천 코드', value: myCode, mono: true, highlight: true },
                    ].map((row, i, arr) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 14px',
                        borderBottom: i < arr.length - 1 ? '1px solid var(--border-primary)' : 'none',
                        gap: 12,
                      }}>
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-main)', fontWeight: 500, flexShrink: 0 }}>
                          {row.label}
                        </span>
                        <span style={{
                          fontSize: 13, fontWeight: 700, textAlign: 'right',
                          fontFamily: row.mono ? 'var(--font-mono)' : 'var(--font-main)',
                          color: row.highlight ? '#a78bfa' : 'var(--text-primary)',
                          letterSpacing: row.mono ? '0.06em' : 0,
                        }}>{row.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* 내 추천 코드 안내 */}
                  <div style={{
                    padding: '10px 12px', marginBottom: 20,
                    background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.2)',
                    borderRadius: 4, display: 'flex', gap: 10, alignItems: 'flex-start',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                    <p style={{ fontSize: 13, color: '#a08020', lineHeight: 1.6, margin: 0, fontFamily: 'var(--font-main)' }}>
                      등록 완료 후{' '}
                      <span style={{ fontFamily: 'var(--font-mono)', color: '#a78bfa', fontWeight: 700 }}>{myCode}</span>
                      {' '}가 내 추천 코드로 발급됩니다. 새 멤버를 초대할 때 사용하세요.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="av-btn-ghost" onClick={() => setStep('ct')}>← 수정</button>
                    <button
                      className="av-btn-primary"
                      style={{ flex: 1 }}
                      disabled={submitting}
                      onClick={handleSubmit}
                    >
                      {submitting
                        ? <><span className="av-spinner" /> 등록 중...</>
                        : '✓ 즉시 등록하기'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Done ── */}
              {step === 'done' && (
                <div style={{ animation: 'stepIn 0.3s ease both', textAlign: 'center', padding: '8px 0 4px' }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: '50%',
                    background: 'rgba(52,211,153,0.1)', border: '1.5px solid #34d399',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 20px',
                  }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>

                  <div style={{ fontFamily: 'var(--font-main)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
                    레그 등록이 완료되었습니다
                  </div>
                  <div style={{ fontFamily: 'var(--font-main)', fontSize: 14, color: 'var(--text-tertiary)', lineHeight: 1.75, marginBottom: 20 }}>
                    CT 계정{' '}
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}>{form.ctAccount}</span>
                    이<br />메인 네트워크에 즉시 추가되었습니다.
                  </div>

                  {/* Active badge */}
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '7px 16px', marginBottom: 20,
                    background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.25)',
                    borderRadius: 20,
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399' }} />
                    <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: '#34d399' }}>ACTIVE · 네트워크 등록 완료</span>
                  </div>

                  {/* 내 추천 코드 */}
                  <div style={{
                    margin: '0 0 24px', padding: '14px 16px',
                    background: 'var(--bg-inset)', border: '1px solid var(--border-secondary)', borderRadius: 6,
                  }}>
                    <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>내 추천 코드</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.15em' }}>
                      {myCode}
                    </div>
                    <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
                      이 코드를 새 멤버에게 공유해 하위 레그를 확장하세요.
                    </div>
                  </div>

                  <button className="av-btn-primary" onClick={onClose}>
                    네트워크로 돌아가기
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )

  return createPortal(content, document.body)
}
