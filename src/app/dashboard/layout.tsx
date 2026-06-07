'use client'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import PageTransition from '@/components/PageTransition'

const NAV_ITEMS = [
  {
    section: 'NETWORK',
    items: [
      { href: '/dashboard', label: '메인 네트워크', icon: 'home', exact: true },
      { href: '/dashboard/analytics', label: '성과 분석', icon: 'chart' },
      { href: '/dashboard/network', label: '글로벌 네트워크', icon: 'globe' },
      { href: '/init', label: '네트워크 초기화', icon: 'layers' },
    ],
  },
  {
    section: 'ACCOUNT',
    items: [
      { href: '/dashboard/profile', label: '내 프로필', icon: 'user' },
    ],
  },
]

const PAGE_NAMES: Record<string, string> = {
  '/dashboard': '메인 네트워크',
  '/dashboard/analytics': '성과 분석',
  '/dashboard/network': '글로벌 네트워크',
  '/dashboard/profile': '내 프로필',
}

function Icon({ name }: { name: string }) {
  const attrs = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'home':
      return <svg {...attrs}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    case 'chart':
      return <svg {...attrs}><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
    case 'globe':
      return <svg {...attrs}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
    case 'layers':
      return <svg {...attrs}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
    case 'user':
      return <svg {...attrs}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    case 'logout':
      return <svg {...attrs}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
    default:
      return null
  }
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  const currentPageName = PAGE_NAMES[pathname] ?? '대시보드'

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      <style>{`
        .layout-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          font-family: var(--font-main);
          font-size: 13px;
          color: var(--text-secondary);
          text-decoration: none;
          cursor: pointer;
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
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 16px;
          font-family: var(--font-main);
          font-size: 13px;
          color: var(--text-tertiary);
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s;
        }
        .layout-logout-btn:hover { background: rgba(148,163,184,0.05); color: var(--text-secondary); }
        .layout-top-nav {
          height: 48px;
          display: flex;
          align-items: center;
          padding: 0 20px;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-primary);
          gap: 12px;
          flex-shrink: 0;
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
        {/* Top Nav */}
        <div className="layout-top-nav">
          {/* Logo */}
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
            }}>U</div>
          </div>
        </div>

        {/* Body: sidebar + content */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', flex: 1, overflow: 'hidden' }}>
          {/* Left Sidebar */}
          <aside style={{
            background: 'var(--bg-surface)',
            borderRight: '1px solid var(--border-primary)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Nav sections */}
            <nav style={{ flex: 1, overflowY: 'auto', paddingTop: 8 }}>
              {NAV_ITEMS.map(section => (
                <div key={section.section}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    fontWeight: 600,
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
    </>
  )
}
