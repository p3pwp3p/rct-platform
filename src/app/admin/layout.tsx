'use client'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import ThemeToggle from '@/components/ThemeToggle'

const NAV = [
  {
    section: 'OVERVIEW',
    items: [
      { href: '/admin', label: '관리자 홈', icon: 'grid', exact: true },
    ],
  },
  {
    section: 'MANAGEMENT',
    items: [
      { href: '/admin/requests', label: '레그 등록 현황', icon: 'inbox' },
      { href: '/admin/members',  label: '회원 관리',      icon: 'users' },
      { href: '/admin/legs',     label: '전체 레그 현황', icon: 'network', exact: true },
      { href: '/admin/legs/tree', label: '트리 뷰',        icon: 'tree' },
      { href: '/admin/sales',    label: '매출 관리',       icon: 'sales' },
    ],
  },
  {
    section: 'PAYOUTS',
    items: [
      { href: '/admin/payouts',   label: '수당 지급 관리', icon: 'payout', exact: true },
      { href: '/admin/payouts/ledger', label: '노드별 수령 현황', icon: 'ledger' },
      { href: '/admin/forfeited', label: '회사 매출',       icon: 'revenue' },
    ],
  },
  {
    section: 'CONTENT',
    items: [
      { href: '/admin/popups', label: '홈 팝업 관리', icon: 'popup' },
      { href: '/admin/terms',  label: '약관 관리',    icon: 'terms' },
    ],
  },
  {
    section: 'HISTORY',
    items: [
      { href: '/admin/history/rank',   label: '직급 변경 이력', icon: 'history' },
      { href: '/admin/history/status', label: '상태 변경 이력', icon: 'history' },
    ],
  },
]

function Icon({ name }: { name: string }) {
  const a = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'grid':    return <svg {...a}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
    case 'inbox':   return <svg {...a}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
    case 'users':   return <svg {...a}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    case 'network': return <svg {...a}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
    case 'tree':    return <svg {...a}><line x1="12" y1="2" x2="12" y2="8"/><path d="M5 8h14"/><line x1="5" y1="8" x2="5" y2="14"/><line x1="19" y1="8" x2="19" y2="14"/><path d="M2 14h6"/><path d="M16 14h6"/></svg>
    case 'logout':  return <svg {...a}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
    case 'sales':   return <svg {...a}><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
    case 'payout':    return <svg {...a}><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
    case 'ledger':    return <svg {...a}><path d="M4 3h12l4 4v14a0 0 0 0 1 0 0H4a0 0 0 0 1 0 0z"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>
    case 'forfeited': return <svg {...a}><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
    case 'revenue':   return <svg {...a}><circle cx="12" cy="12" r="9"/><path d="M14.8 9.3a2.5 2.5 0 0 0-2.3-1.3c-1.4 0-2.5.8-2.5 2 0 2.6 5 1.4 5 4 0 1.2-1.1 2-2.5 2a2.5 2.5 0 0 1-2.3-1.3"/><line x1="12" y1="6.5" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="17.5"/></svg>
    case 'history':   return <svg {...a}><polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 1 0 .5-3"/><polyline points="3 4 3 11 10 11"/></svg>
    case 'popup':     return <svg {...a}><rect x="3" y="4" width="18" height="13" rx="2"/><line x1="3" y1="8" x2="21" y2="8"/><circle cx="6" cy="6" r="0.5"/><line x1="9" y1="21" x2="15" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
    case 'terms':     return <svg {...a}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
    default: return null
  }
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  // 관리자 확정 전에는 관리자 화면을 렌더하지 않는다 (회원이 잠깐 admin
  // 셸을 보고 /dashboard 로 튕기는 깜빡임 방지)
  const [authChecked, setAuthChecked] = useState(false)

  // 라우트 이동 시 모바일 드로어 자동 닫기
  useEffect(() => { setMobileNavOpen(false) }, [pathname])

  // ── 인증 가드 ──────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error || !user) { supabase.auth.signOut(); router.replace('/login'); return }
      // admin이 아닌 계정은 /dashboard로 강제 이동
      if (user.app_metadata?.role !== 'admin') {
        router.replace('/dashboard')
        return
      }
      setAuthChecked(true)
    })

    // 토큰 만료 / 리프레시 실패 시 자동 로그아웃
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.replace('/login')
    })
    return () => subscription.unsubscribe()
  }, [router])
  // ──────────────────────────────────────────────────────

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // 관리자 확정 전: 차분한 전체 로더 (회원은 이 화면만 보고 /dashboard 로 이동)
  if (!authChecked) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <style>{`@keyframes gateSpin { to { transform: rotate(360deg); } } @keyframes loaderFadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, animation: 'loaderFadeIn 0.2s ease-out 0.15s both' }}>
          <div style={{ width: 14, height: 14, border: '2px solid var(--border-secondary)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'gateSpin 0.7s linear infinite' }} />
          <span style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)' }}>불러오는 중</span>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        .admin-nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 16px; border-radius: 0;
          font-family: var(--font-main); font-size: 13px;
          color: var(--text-secondary); text-decoration: none;
          cursor: pointer; transition: background 0.15s, color 0.15s;
          border-left: 2px solid transparent;
          position: relative;
        }
        .admin-nav-item:hover { background: rgba(148,163,184,0.05); color: var(--text-primary); }
        .admin-nav-item.active {
          background: var(--accent-blue-dim);
          color: var(--accent-blue);
          border-left-color: var(--accent-blue);
        }
        .admin-logout-btn {
          display: flex; align-items: center; gap: 10px;
          width: 100%; padding: 9px 16px;
          font-family: var(--font-main); font-size: 13px;
          color: var(--text-tertiary); background: none;
          border: none; cursor: pointer; text-align: left;
          transition: background 0.15s, color 0.15s;
        }
        .admin-logout-btn:hover { background: rgba(148,163,184,0.05); color: var(--text-secondary); }
        .admin-hamburger { display: none; }
        .admin-overlay { display: none; }
        @media (max-width: 768px) {
          .admin-hamburger {
            display: flex; align-items: center; justify-content: center;
            width: 32px; height: 32px; flex-shrink: 0;
            background: none; border: none; cursor: pointer;
            color: var(--text-secondary); padding: 0; margin-right: 2px;
          }
          .admin-body { grid-template-columns: 1fr !important; }
          .admin-sidebar {
            position: fixed !important;
            top: 48px; left: 0; bottom: 0;
            width: 240px; z-index: 120;
            transform: translateX(-100%);
            transition: transform 0.22s ease;
            box-shadow: 0 0 32px rgba(0,0,0,0.5);
          }
          .admin-sidebar.open { transform: translateX(0); }
          .admin-overlay {
            display: block;
            position: fixed; inset: 48px 0 0 0; z-index: 110;
            background: rgba(0,0,0,0.5);
          }
          /* 모든 admin 표를 가로 스크롤 가능하게 (셀 줄바꿈 방지) + 얇은 스크롤바 */
          .admin-content table { display: block; overflow-x: auto; white-space: nowrap; max-width: 100%; }
          .admin-content table::-webkit-scrollbar { height: 6px; }
          .admin-content table::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.3); border-radius: 3px; }
          /* KPI 등 repeat() 그리드를 2열로 접기 (인라인 오버라이드) */
          .admin-content [style*="grid-template-columns: repeat("] { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
        {/* Top nav */}
        <div style={{
          height: 48, display: 'flex', alignItems: 'center',
          padding: '0 20px', gap: 12, flexShrink: 0,
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-primary)',
        }}>
          <button className="admin-hamburger" onClick={() => setMobileNavOpen(o => !o)} aria-label="메뉴">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>RCT Platform</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-secondary)' }}>관리자</span>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <ThemeToggle />
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              padding: '2px 8px', borderRadius: 4, letterSpacing: '0.08em',
              border: '1px solid rgba(239,68,68,0.4)',
              color: '#ef4444', background: 'rgba(239,68,68,0.06)',
            }}>ADMIN</span>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ef4444',
            }}>A</div>
          </div>
        </div>

        <div className="admin-body" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', flex: 1, overflow: 'hidden', position: 'relative' }}>
          {/* 모바일 드로어 오버레이 */}
          {mobileNavOpen && <div className="admin-overlay" onClick={() => setMobileNavOpen(false)} />}
          {/* Sidebar */}
          <aside className={`admin-sidebar${mobileNavOpen ? ' open' : ''}`} style={{
            background: 'var(--bg-surface)',
            borderRight: '1px solid var(--border-primary)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <nav style={{ flex: 1, overflowY: 'auto', paddingTop: 8 }}>
              {NAV.map(section => (
                <div key={section.section}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.14em',
                    color: 'var(--text-tertiary)', padding: '16px 16px 6px',
                  }}>
                    {section.section}
                  </div>
                  {section.items.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`admin-nav-item${isActive(item.href, (item as any).exact) ? ' active' : ''}`}
                    >
                      <Icon name={item.icon} />
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {(item as any).badge && (
                        <span style={{
                          minWidth: 18, height: 18, borderRadius: 9,
                          background: '#ef4444', color: '#fff',
                          fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: '0 5px',
                        }}>
                          {(item as any).badge}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>

            <div style={{ borderTop: '1px solid var(--border-primary)', padding: '8px 0' }}>
              <button className="admin-logout-btn" onClick={handleLogout}>
                <Icon name="logout" />
                로그아웃
              </button>
            </div>
          </aside>

          {/* Content */}
          <main className="admin-content" style={{ overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            {children}
          </main>
        </div>
      </div>
    </>
  )
}
