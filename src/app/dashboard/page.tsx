'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getDashboardData } from '@/lib/db'
import { useProfile } from '@/lib/contexts/ProfileContext'
import type { DashboardData, Rank } from '@/lib/types'
import { RANK_COLOR, RANK_ORDER, RANK_REQUIREMENTS, nextRank, sumRankGte } from '@/lib/ranks'

function fmt(n: number) {
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 0 })
}

// ─── 게이지 ───────────────────────────────────────────────────────────
function Gauge({ cur, need, color }: { cur: number; need: number; color: string }) {
  const pct  = need > 0 ? Math.min(1, cur / need) : 1
  const done = pct >= 1
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
      <div style={{ flex: 1, height: 4, background: 'var(--bg-inset)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct * 100}%`, borderRadius: 2,
          background: done ? '#34d399' : color,
          transition: 'width 0.6s ease',
        }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: done ? '#34d399' : 'var(--text-primary)', fontWeight: 700, minWidth: 14 }}>{cur}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>/ {need}</span>
      {done && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
    </div>
  )
}

// ─── 스켈레톤 ────────────────────────────────────────────────────────
function Skeleton({ w = '100%', h = 16, r = 4 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg, var(--bg-inset) 25%, var(--border-primary) 50%, var(--bg-inset) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
    }} />
  )
}

// ─── 메인 ─────────────────────────────────────────────────────────────
export default function DashboardHome() {
  const { activeProfile, loading: profileLoading } = useProfile()
  const [data, setData]       = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const { profiles: allProfiles } = useProfile()

  useEffect(() => {
    if (profileLoading) return
    if (!activeProfile) { setLoading(false); return }
    setLoading(true)
    setData(null)
    getDashboardData(activeProfile.id)
      .then(d => setData(d))
      .catch(e => { console.error(e); setError('데이터를 불러오지 못했습니다.') })
      .finally(() => setLoading(false))
  }, [activeProfile?.id, profileLoading])

  const profile    = data?.profile
  const legStats   = data?.legStats
  const recent     = data?.recentDownline ?? []
  const myRank: Rank = profile?.rank ?? 'R0'
  const rankColor  = RANK_COLOR[myRank]
  const myRankIdx  = RANK_ORDER.indexOf(myRank)
  const nxt        = nextRank(myRank)
  const nxtReq     = nxt ? RANK_REQUIREMENTS[myRank] : null
  const leftSales  = legStats?.left.sales  ?? 0
  const rightSales = legStats?.right.sales ?? 0
  const totalLeg   = leftSales + rightSales
  const leftPct    = totalLeg > 0 ? (leftSales / totalLeg) * 100 : 50
  const rightPct   = 100 - leftPct
  const balanceDiff = rightSales > 0
    ? ((leftSales / rightSales - 1) * 100).toFixed(0)
    : null

  // 다음 직급에 필요한 각 leg 달성자 수 (rank ≥ 조건) — sumRankGte 는 단일 소스
  const legRankKey: Rank = nxtReq && nxtReq.legRank ? nxtReq.legRank : myRank
  const leftLegRankCount  = sumRankGte(legStats?.left.rankCounts,  legRankKey)
  const rightLegRankCount = sumRankGte(legStats?.right.rankCounts, legRankKey)
  // 레그 전체 멤버 수 (legMembers 조건용)
  const leftLegTotal  = legStats?.left.total  ?? 0
  const rightLegTotal = legStats?.right.total ?? 0

  // 노드 없음 — 빈 상태 안내
  if (!profileLoading && allProfiles.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 18, padding: 40 }}>
        <div style={{ width: 56, height: 56, borderRadius: 12, background: 'rgba(77,182,172,0.08)', border: '1px solid rgba(77,182,172,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            등록된 CT 노드가 없습니다
          </div>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.7 }}>
            좌측 사이드바의 <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>노드 추가</span> 버튼을 눌러<br />
            후원인 코드로 CT 계좌를 등록하세요.
          </div>
        </div>
        <div style={{ marginTop: 4, padding: '10px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <span style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)' }}>
            CT 계좌가 여러 개라면 노드를 여러 번 추가할 수 있습니다.
          </span>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .home-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(148,163,184,0.12) transparent;
        }
        .home-scroll::-webkit-scrollbar { width: 4px; }
        .home-scroll::-webkit-scrollbar-track { background: transparent; }
        .home-scroll::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.12); border-radius: 2px; }
        .home-scroll::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,0.28); }
        .home-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-primary);
          border-radius: 10px;
        }
        .quick-link {
          display: flex; align-items: center; gap: 14px;
          padding: 15px 18px;
          background: var(--bg-surface);
          border: 1px solid var(--border-primary);
          border-radius: 10px;
          text-decoration: none;
          transition: border-color 0.15s, background 0.15s;
          cursor: pointer;
        }
      `}</style>

      {/* 루트: 좌우 분할 */}
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

        {/* ── 메인 콘텐츠 (스크롤) ── */}
        <div className="home-scroll" style={{
          flex: 1, overflowY: 'auto',
          padding: '24px 24px 40px 28px',
          boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>

          {error && (
            <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontFamily: 'var(--font-main)', fontSize: 13, color: '#f87171' }}>
              {error}
            </div>
          )}

          {/* 멤버 배너 */}
          <div className="home-card" style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{
              width: 50, height: 50, borderRadius: '50%', flexShrink: 0,
              background: rankColor + '18', border: `2px solid ${rankColor}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: rankColor,
            }}>
              {loading ? '—' : myRank === 'R0' ? '—' : myRank}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                {loading
                  ? <Skeleton w={120} h={18} />
                  : <>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {profile?.node_id ?? '—'}
                      </span>
                      <span style={{
                        fontFamily: myRank === 'R0' ? 'var(--font-main)' : 'var(--font-mono)',
                        fontSize: 11, fontWeight: 700, color: rankColor,
                        background: rankColor + '18', border: `1px solid ${rankColor}44`,
                        padding: '2px 8px', borderRadius: 5,
                      }}>{myRank}</span>
                    </>
                }
              </div>
              <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)' }}>
                {loading ? <Skeleton w={100} h={12} /> : `가입일 ${profile?.created_at?.slice(0, 10) ?? '—'}`}
              </div>
            </div>
          </div>

          {/* KPI 4개 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {[
              {
                label: '역대 하위 매출', labelMono: false, color: rankColor,
                value: loading ? null : fmt((legStats?.left.sales ?? 0) + (legStats?.right.sales ?? 0)),
                sub: '누적 총합',
              },
              {
                label: '직추천', labelMono: false, color: '#34d399',
                value: loading ? null : `${legStats?.directReferrals ?? 0}`,
                sub: nxtReq ? `목표 ${nxtReq.direct}` : '최고 직급',
              },
              {
                label: 'Left Leg', labelMono: true, color: '#60a5fa',
                value: loading ? null : `${legStats?.left.total ?? 0}`,
                sub: loading ? '' : `매출 ${fmt(legStats?.left.sales ?? 0)}`,
              },
              {
                label: 'Right Leg', labelMono: true, color: '#a78bfa',
                value: loading ? null : `${legStats?.right.total ?? 0}`,
                sub: loading ? '' : `매출 ${fmt(legStats?.right.sales ?? 0)}`,
              },
            ].map(k => (
              <div key={k.label} className="home-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{
                  fontFamily: k.labelMono ? 'var(--font-mono)' : 'var(--font-main)',
                  fontSize: 12, color: 'var(--text-tertiary)',
                  letterSpacing: k.labelMono ? '0.05em' : 0,
                }}>{k.label}</span>
                {k.value === null
                  ? <Skeleton w="60%" h={28} />
                  : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, color: k.color, lineHeight: 1.1 }}>{k.value}</span>
                }
                <span style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)' }}>{k.sub}</span>
              </div>
            ))}
          </div>

          {/* 2열: 달성 현황 + Leg 현황 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

            {/* 다음 직급 달성 현황 */}
            <div className="home-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-main)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {nxt ? `${nxt} 달성 현황` : '최고 직급 달성'}
                </span>
                <Link href="/dashboard/analytics" style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--accent-blue)', textDecoration: 'none' }}>자세히 →</Link>
              </div>

              {nxtReq ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>직추천</span>
                    <Gauge cur={legStats?.directReferrals ?? 0} need={nxtReq.direct} color={RANK_COLOR[nxt!]} />
                  </div>

                  {(nxtReq.legRank || (nxtReq.legTotal ?? 0) > 0) && (
                    <>
                      <div style={{ borderTop: '1px solid var(--border-primary)' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {nxtReq.legRank ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)' }}>
                            각 라인
                            <span style={{
                              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                              color: RANK_COLOR[nxtReq.legRank],
                              background: RANK_COLOR[nxtReq.legRank] + '18',
                              border: `1px solid ${RANK_COLOR[nxtReq.legRank]}44`,
                              padding: '1px 6px', borderRadius: 4,
                            }}>{nxtReq.legRank}</span>
                            달성자 {nxtReq.legCount}명
                          </div>
                        ) : (
                          <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)' }}>
                            각 라인 멤버 {nxtReq.legTotal}명 이상
                          </div>
                        )}
                        {[
                          {
                            label: 'Left Leg',
                            cur:   nxtReq.legRank ? leftLegRankCount  : leftLegTotal,
                            need:  nxtReq.legRank ? (nxtReq.legCount ?? 0) : (nxtReq.legTotal ?? 0),
                            col:   '#60a5fa',
                          },
                          {
                            label: 'Right Leg',
                            cur:   nxtReq.legRank ? rightLegRankCount : rightLegTotal,
                            need:  nxtReq.legRank ? (nxtReq.legCount ?? 0) : (nxtReq.legTotal ?? 0),
                            col:   '#a78bfa',
                          },
                        ].map(leg => (
                          <div key={leg.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, color: leg.col, width: 72, flexShrink: 0 }}>
                              {leg.label}
                            </span>
                            <Gauge cur={leg.cur} need={leg.need} color={leg.col} />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  R5 최고 직급 달성자입니다
                </div>
              )}
            </div>

            {/* Leg 현황 */}
            <div className="home-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-main)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Leg 현황
                </span>
                <Link href="/dashboard/tree" style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--accent-blue)', textDecoration: 'none' }}>트리 보기 →</Link>
              </div>

              <div>
                <div style={{ display: 'flex', height: 7, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-inset)', marginBottom: 7 }}>
                  <div style={{ width: `${leftPct}%`, background: '#60a5fa' }} />
                  <div style={{ flex: 1, background: '#a78bfa' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#60a5fa' }}>{leftPct.toFixed(1)}%</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#a78bfa' }}>{rightPct.toFixed(1)}%</span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-primary)' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {[
                  { label: 'Left Leg',  total: legStats?.left.total ?? 0,  sales: leftSales,  col: '#60a5fa' },
                  { label: 'Right Leg', total: legStats?.right.total ?? 0, sales: rightSales, col: '#a78bfa' },
                ].map((leg, i) => (
                  <div key={leg.label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 0',
                    borderBottom: i === 0 ? '1px solid var(--border-primary)' : 'none',
                  }}>
                    <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, color: leg.col }}>{leg.label}</span>
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                      <div style={{ textAlign: 'right' }}>
                        {loading ? <Skeleton w={40} h={14} /> : <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{leg.total}</div>}
                        <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)' }}>총 계좌</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {loading ? <Skeleton w={40} h={14} /> : <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: leg.col }}>{fmt(leg.sales)}</div>}
                        <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)' }}>매출</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {balanceDiff !== null && Number(balanceDiff) > 5 && (
                <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: '#fbbf24' }}>
                  ⚠ Right Leg &lt; Left Leg ({balanceDiff}% 차이) — Right Leg 강화를 권장합니다.
                </div>
              )}
            </div>
          </div>

          {/* 바로가기 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            {[
              {
                href: '/dashboard/tree', label: '네트워크 트리', desc: '내 네트워크 트리 시각화', color: '#60a5fa',
                icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v6M12 22v-6M12 8a4 4 0 0 1-4 4H4M12 8a4 4 0 0 0 4 4h4M12 16a4 4 0 0 1-4-4H4M12 16a4 4 0 0 0 4-4h4"/></svg>,
              },
              {
                href: '/dashboard/analytics', label: '성과 분석', desc: '직급 달성 현황 및 매출 추이', color: '#fbbf24',
                icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
              },
            ].map(item => (
              <Link key={item.href} href={item.href} className="quick-link"
                style={{ color: 'inherit' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = item.color + '55'; el.style.background = item.color + '08' }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = 'var(--border-primary)'; el.style.background = 'var(--bg-surface)' }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                  background: item.color + '14', border: `1px solid ${item.color}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color,
                }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-main)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{item.label}</div>
                  <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)' }}>{item.desc}</div>
                </div>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            ))}
          </div>

        </div>{/* /main */}

        {/* ── 우측 사이드바 ── */}
        <aside className="home-scroll" style={{
          width: 280, flexShrink: 0,
          borderLeft: '1px solid var(--border-primary)',
          background: 'var(--bg-surface)',
          overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 0,
        }}>

          {/* 내 추천 코드 */}
          <div style={{ padding: '22px 20px', borderBottom: '1px solid var(--border-primary)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 12 }}>
              My Referral Code
            </div>
            <div style={{
              background: 'var(--bg-inset)', border: '1px solid rgba(167,139,250,0.25)',
              borderRadius: 8, padding: '13px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              {loading
                ? <Skeleton w={140} h={22} />
                : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.14em' }}>
                    {profile?.referral_code ?? '—'}
                  </span>
              }
              {profile?.referral_code && (
                <button
                  onClick={() => navigator.clipboard.writeText(profile.referral_code)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#a78bfa')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              )}
            </div>
            <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 9 }}>
              레그 노드 고유의 추천 코드입니다.
            </div>
          </div>

          {/* 직급 로드맵 */}
          <div style={{ padding: '22px 20px', borderBottom: '1px solid var(--border-primary)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 18 }}>
              Rank Roadmap
            </div>

            {/* 트랙 컨테이너 — 왼쪽에 단일 세로선 */}
            <div style={{ position: 'relative', paddingLeft: 32 }}>
              {/* 배경 세로선 전체 */}
              <div style={{
                position: 'absolute', left: 9, top: 10, bottom: 10,
                width: 2, background: 'var(--border-primary)', borderRadius: 1,
              }} />
              {/* 완료 구간 채우기 */}
              <div style={{
                position: 'absolute', left: 9, top: 10,
                width: 2, borderRadius: 1,
                height: `calc(${(myRankIdx / (RANK_ORDER.length - 1)) * 100}% - 10px)`,
                background: `linear-gradient(to bottom, ${RANK_COLOR['R0']}88, ${RANK_COLOR[myRank]})`,
              }} />

              {RANK_ORDER.map((rank, idx) => {
                const color     = RANK_COLOR[rank]
                const isCurrent = rank === myRank
                const isPast    = idx < myRankIdx
                const isFuture  = idx > myRankIdx

                return (
                  <div key={rank} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '7px 0',
                    position: 'relative',
                  }}>
                    {/* 도트 — 선 위에 올라와야 하므로 불투명 배경 필수 */}
                    <div style={{
                      position: 'absolute',
                      left: -32 + 10 - (isCurrent ? 7 : 5),
                      width:  isCurrent ? 14 : 10,
                      height: isCurrent ? 14 : 10,
                      borderRadius: '50%',
                      background: isFuture
                        ? 'var(--bg-surface)'
                        : isPast
                          ? 'var(--bg-surface)'
                          : color,
                      border: `2px solid ${isFuture ? 'var(--border-secondary)' : color}`,
                      boxShadow: isCurrent ? `0 0 10px ${color}99, 0 0 0 3px ${color}22` : 'none',
                      transition: 'all 0.2s',
                      zIndex: 2,
                    }} />

                    {/* 행 콘텐츠 */}
                    <div style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: isCurrent ? '7px 12px' : '5px 0',
                      borderRadius: isCurrent ? 7 : 0,
                      background: isCurrent ? color + '0d' : 'transparent',
                      border: isCurrent ? `1px solid ${color}33` : '1px solid transparent',
                      transition: 'all 0.2s',
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: isCurrent ? 15 : 13,
                        fontWeight: isCurrent ? 700 : isPast ? 500 : 400,
                        color: isFuture ? 'var(--text-tertiary)' : color,
                      }}>{rank}</span>

                      {isCurrent && (
                        <span style={{
                          fontFamily: 'var(--font-main)', fontSize: 10, fontWeight: 700,
                          color: color, background: color + '22',
                          border: `1px solid ${color}55`,
                          padding: '2px 7px', borderRadius: 4,
                        }}>현재</span>
                      )}
                      {isPast && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color + '99'} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 최근 네트워크 등록 */}
          <div style={{ padding: '22px 20px 0', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>
                Recent Registrations
              </div>
              <Link href="/dashboard/tree" style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--accent-blue)', textDecoration: 'none' }}>
                전체 →
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, margin: '0 -20px' }}>
              {loading
                ? [0,1,2,3,4].map(i => (
                    <div key={i} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--border-primary)', flexShrink: 0 }} />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <Skeleton w="70%" h={12} />
                        <Skeleton w="50%" h={10} />
                      </div>
                    </div>
                  ))
                : recent.length === 0
                  ? <div style={{ padding: '20px', fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                      아직 하위 계좌가 없습니다
                    </div>
                  : recent.map((r, i) => {
                      const legColor = r.leg_position === 'LEFT' ? '#60a5fa' : '#a78bfa'
                      return (
                        <div key={r.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '12px 20px',
                          borderTop: i === 0 ? '1px solid var(--border-primary)' : 'none',
                          borderBottom: '1px solid var(--border-primary)',
                        }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: legColor, boxShadow: `0 0 5px ${legColor}` }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent-blue)', marginBottom: 3 }}>{r.node_id}</div>
                            <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)' }}>{r.depth}단계 · {r.created_at?.slice(0, 10)}</div>
                          </div>
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                            color: legColor, background: legColor + '14',
                            border: `1px solid ${legColor}33`,
                            padding: '2px 8px', borderRadius: 4, flexShrink: 0,
                          }}>{r.leg_position}</span>
                        </div>
                      )
                    })
              }
            </div>
          </div>

        </aside>

      </div>{/* /root flex */}
    </>
  )
}
