'use client'
/**
 * /dashboard/tree
 * 트리 뷰 — 후원 (바이너리) + 추천 (N-ary) 탭 통합
 */
import { useState, useEffect, useCallback } from 'react'
import { useProfile } from '@/lib/contexts/ProfileContext'
import { getMyTree } from '@/lib/db'
import type { TreeNode } from '@/lib/types'
import BinaryTreeCanvas, { NetNode } from '@/components/BinaryTreeCanvas'
import ReferralTreeCanvas from '@/components/ReferralTreeCanvas'

type Tab = 'sponsor' | 'referral'

function convertTree(node: TreeNode): NetNode {
  const children: NetNode[] = []
  if (node.left)  children.push(convertTree(node.left))
  if (node.right) children.push(convertTree(node.right))
  return {
    id:           node.id,
    nodeId:       node.node_id,
    referralCode: node.referral_code,
    name:         node.name,
    rank:         node.rank,
    sales:        node.sales ?? 0,
    mt5AccountId: node.mt5_account_id ?? '',
    legPosition:  node.leg_position as 'LEFT' | 'RIGHT' | null | undefined,
    joined:       node.created_at,
    children,
  }
}

// ── 탭 버튼 ──────────────────────────────────────────────────────────────────
function TabBtn({ active, color, icon, label, badge, onClick }: {
  active: boolean; color: string; icon: React.ReactNode
  label: string; badge: string; onClick: () => void
}) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8,
      height: '100%', padding: '0 22px',
      background: 'none', border: 'none', cursor: 'pointer',
      borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
      transition: 'all 0.15s',
    }}>
      {/* 아이콘 */}
      <span style={{ color: active ? color : 'var(--text-tertiary)', display: 'flex', transition: 'color 0.15s' }}>
        {icon}
      </span>
      {/* 라벨: 한글은 font-main */}
      <span style={{
        fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: active ? 700 : 500,
        color: active ? color : 'var(--text-secondary)',
        letterSpacing: 0, whiteSpace: 'nowrap', transition: 'all 0.15s',
      }}>
        {label}
      </span>
      {/* 배지: font-mono */}
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500,
        letterSpacing: '0.03em',
        color:      active ? color + 'cc'  : 'var(--text-tertiary)',
        background: 'var(--bg-inset)',
        border:     `1px solid ${active ? color + '44' : 'var(--border-primary)'}`,
        padding: '2px 8px', borderRadius: 4,
        whiteSpace: 'nowrap', transition: 'all 0.15s',
      }}>
        {badge}
      </span>
    </button>
  )
}

export default function TreePage() {
  const { activeProfile, loading: profileLoading } = useProfile()
  const [tab, setTab]         = useState<Tab>('sponsor')
  const [tree, setTree]       = useState<NetNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (profileLoading) return
    if (!activeProfile) { setLoading(false); return }
    setLoading(true); setError(null); setTree(null)
    getMyTree(activeProfile.id)
      .then(raw => setTree(raw ? convertTree(raw) : null))
      .catch(e => { console.error(e); setError('트리 데이터를 불러오지 못했습니다.') })
      .then(() => setLoading(false), () => setLoading(false))
  }, [activeProfile?.id, profileLoading])

  const isMe = useCallback((id: string) => id === activeProfile?.id, [activeProfile?.id])

  const SPONSOR_ICON = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="3" x2="12" y2="8"/><path d="M5 8h14"/>
      <line x1="5" y1="8" x2="5" y2="14"/><line x1="19" y1="8" x2="19" y2="14"/>
      <path d="M2 14h6"/><path d="M16 14h6"/>
    </svg>
  )
  const REFERRAL_ICON = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2"/><line x1="12" y1="7" x2="12" y2="11"/>
      <path d="M12 11 L6 16 M12 11 L12 16 M12 11 L18 16"/>
      <circle cx="6" cy="18" r="2"/><circle cx="12" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>
    </svg>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-base)' }}>

      {/* ── 탭 바 ── */}
      <div style={{
        height: 52, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 20px', gap: 0,
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-primary)',
      }}>
        {/* 타이틀 */}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginRight: 24, whiteSpace: 'nowrap' }}>
          Network Tree View
        </span>
        <div style={{ width: 1, height: 20, background: 'var(--border-primary)', marginRight: 4, flexShrink: 0 }} />

        <TabBtn active={tab === 'sponsor'}  color="#60a5fa" icon={SPONSOR_ICON}  label="후원 트리" badge="Binary  L / R"   onClick={() => setTab('sponsor')} />
        <TabBtn active={tab === 'referral'} color="#a78bfa" icon={REFERRAL_ICON} label="추천 트리" badge="N-ary  Unlimited" onClick={() => setTab('referral')} />
      </div>

      {/* ── 콘텐츠: 항상 캔버스 컴포넌트가 처리 ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* 후원 트리 — display:none 으로 숨겨서 상태 유지 */}
        <div style={{ flex: 1, display: tab === 'sponsor' ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>
          <BinaryTreeCanvas
            tree={tree}
            loading={loading || profileLoading}
            error={error}
            isMe={isMe}
            labelMode="code"
          />
        </div>
        {/* 추천 트리 */}
        <div style={{ flex: 1, display: tab === 'referral' ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>
          <ReferralTreeCanvas
            profileId={activeProfile?.id ?? ''}
            loading={profileLoading}
            isMe={isMe}
            labelMode="code"
          />
        </div>
      </div>
    </div>
  )
}
