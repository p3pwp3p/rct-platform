'use client'
/**
 * /admin/legs/tree
 * 트리 뷰 — 후원 (바이너리) + 추천 (N-ary) 탭 통합 (어드민)
 */
import { useState, useEffect } from 'react'
import { adminGetTree } from '@/lib/db-admin'
import type { TreeNode } from '@/lib/types'
import BinaryTreeCanvas, { NetNode } from '@/components/BinaryTreeCanvas'
import ReferralTreeCanvas from '@/components/ReferralTreeCanvas'

type Tab = 'sponsor' | 'referral'

function convertTree(t: TreeNode): NetNode {
  const children: NetNode[] = []
  if (t.left)  children.push(convertTree(t.left))
  if (t.right) children.push(convertTree(t.right))
  return {
    id:           t.id,
    nodeId:       t.node_id,
    ctId:         t.ct_id,
    name:         t.name,
    rank:         t.rank,
    sales:        t.sales ?? 0,
    mt5AccountId: t.mt5_account_id ?? '',
    legPosition:  t.leg_position as 'LEFT' | 'RIGHT' | null | undefined,
    joined:       t.created_at,
    children,
  }
}

// ── 검색 바 (추천 트리 루트 선택) ─────────────────────────────────────────────
function SearchBar({ onSearch }: { onSearch: (profileId: string) => void }) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<{ id: string; node_id: string; name: string; rank: string }[]>([])
  const [busy,    setBusy]    = useState(false)

  const doSearch = async () => {
    if (!query.trim()) return
    setBusy(true)
    try {
      const res  = await fetch(`/api/admin/search-members?q=${encodeURIComponent(query.trim())}`)
      const json = await res.json()
      setResults(json.members ?? [])
    } catch { setResults([]) } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-surface)', flexShrink: 0 }}>
      <span style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>루트 검색:</span>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && doSearch()}
        placeholder="이름 또는 노드 ID"
        style={{ flex: 1, maxWidth: 280, padding: '5px 10px', background: 'var(--bg-inset)', border: '1px solid var(--border-secondary)', borderRadius: 5, color: 'var(--text-primary)', fontFamily: 'var(--font-main)', fontSize: 12, outline: 'none' }}
      />
      <button onClick={doSearch} disabled={busy || !query.trim()}
        style={{ padding: '5px 14px', background: '#a78bfa', border: 'none', borderRadius: 5, color: '#000', fontFamily: 'var(--font-main)', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
        {busy ? '…' : '검색'}
      </button>
      {results.map(r => (
        <button key={r.id} onClick={() => { onSearch(r.id); setResults([]); setQuery(r.node_id) }}
          style={{ padding: '3px 10px', background: 'var(--bg-inset)', border: '1px solid var(--border-primary)', borderRadius: 5, color: 'var(--text-secondary)', fontFamily: 'var(--font-main)', fontSize: 11, cursor: 'pointer' }}>
          {r.rank} · {r.node_id} · {r.name}
        </button>
      ))}
    </div>
  )
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
      <span style={{ color: active ? color : 'var(--text-tertiary)', display: 'flex', transition: 'color 0.15s' }}>{icon}</span>
      <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: active ? 700 : 500, color: active ? color : 'var(--text-secondary)', letterSpacing: 0, whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
        {label}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, letterSpacing: '0.03em', color: active ? color + 'cc' : 'var(--text-tertiary)', background: 'var(--bg-inset)', border: `1px solid ${active ? color + '44' : 'var(--border-primary)'}`, padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
        {badge}
      </span>
    </button>
  )
}

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

export default function AdminTreePage() {
  const [tab, setTab]         = useState<Tab>('sponsor')
  const [tree, setTree]       = useState<NetNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [referralProfileId, setReferralProfileId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true); setError(null)
    adminGetTree()
      .then(raw => setTree(raw ? convertTree(raw) : null))
      .catch(e => setError(e?.message ?? '로딩 오류'))
      .then(() => setLoading(false), () => setLoading(false))
  }, [])

  useEffect(() => {
    if (tab !== 'referral' || referralProfileId) return
    fetch('/api/admin/search-members?root=true')
      .then(r => r.json())
      .then(json => { const first = json.members?.[0]; if (first) setReferralProfileId(first.id) })
      .catch(() => {})
  }, [tab, referralProfileId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-base)' }}>

      {/* ── 탭 바 ── */}
      <div style={{ height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 0, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-primary)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginRight: 24, whiteSpace: 'nowrap' }}>
          Network Tree View
        </span>
        <div style={{ width: 1, height: 20, background: 'var(--border-primary)', marginRight: 4, flexShrink: 0 }} />
        <TabBtn active={tab === 'sponsor'}  color="#60a5fa" icon={SPONSOR_ICON}  label="후원 트리" badge="Binary  L / R"   onClick={() => setTab('sponsor')} />
        <TabBtn active={tab === 'referral'} color="#a78bfa" icon={REFERRAL_ICON} label="추천 트리" badge="N-ary  Unlimited" onClick={() => setTab('referral')} />
      </div>

      {/* 추천 탭: 검색 바 */}
      {tab === 'referral' && <SearchBar onSearch={id => setReferralProfileId(id)} />}

      {/* ── 콘텐츠: display:none으로 마운트 유지 ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: tab === 'sponsor' ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>
          <BinaryTreeCanvas tree={tree} loading={loading} error={error} />
        </div>
        <div style={{ flex: 1, display: tab === 'referral' ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>
          <ReferralTreeCanvas profileId={referralProfileId ?? ''} showGenerations={false} />
        </div>
      </div>
    </div>
  )
}
