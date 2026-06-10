'use client'
/**
 * ReferralTreeCanvas
 * 추천 트리 (N-ary) 캔버스 — BinaryTreeCanvas 와 완전히 동일한 UI/UX
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import type { ReferralNode } from '@/app/api/referral-tree/route'

const RANK_COLOR: Record<string, string> = {
  R0: '#64748b', R1: '#34d399', R2: '#60a5fa',
  R3: '#fbbf24', R4: '#f97316', R5: '#a78bfa',
}
// depth 5+ fallback: 회색 계열 순환
function getGenColor(depth: number): string {
  const FALLBACK = ['#94a3b8', '#78909c', '#607d8b', '#546e7a', '#455a64']
  if (GEN_COLOR_MAP[depth] !== undefined) return GEN_COLOR_MAP[depth]
  return FALLBACK[(depth - 5) % FALLBACK.length] ?? '#64748b'
}
function getGenRate(depth: number): string {
  return GEN_RATE[depth] ?? '—'
}

const GEN_COLOR_MAP: Record<number, string> = {
  0: '#94a3b8', 1: '#34d399', 2: '#60a5fa', 3: '#fbbf24', 4: '#f97316',
}
const GEN_RATE: Record<number, string> = { 1: '8%', 2: '4%', 3: '4%', 4: '4%' }
const STATUS_COLOR: Record<string, string> = {
  active: '#34d399', suspended: '#fbbf24', expelled: '#f87171',
}

const NODE_W = 178, NODE_H = 96, H_GAP = 44, V_GAP = 88

interface Pos { node: ReferralNode; x: number; y: number; depth: number }

function layout(tree: ReferralNode): Pos[] {
  const out: Pos[] = []
  function w(n: ReferralNode): number {
    if (!n.children.length) return NODE_W
    return n.children.reduce((s, c) => s + w(c), 0) + H_GAP * (n.children.length - 1)
  }
  function place(n: ReferralNode, cx: number, ty: number, d: number) {
    out.push({ node: n, x: cx, y: ty, depth: d })
    if (!n.children.length) return
    const total = n.children.reduce((s, c) => s + w(c), 0) + H_GAP * (n.children.length - 1)
    let cur = cx - total / 2
    for (const child of n.children) {
      const cw = w(child)
      place(child, cur + cw / 2, ty + NODE_H + V_GAP, d + 1)
      cur += cw + H_GAP
    }
  }
  place(tree, 0, 0, 0)
  return out
}

function Connectors({ positions, selectedId }: { positions: Pos[]; selectedId: string | null }) {
  const byId = new Map(positions.map(p => [p.node.id, p]))
  return (
    <>
      {positions.filter(p => p.node.children.length).flatMap(p =>
        p.node.children.map(child => {
          const cp   = byId.get(child.id); if (!cp) return null
          const midY = p.y + NODE_H + V_GAP / 2
          const sel  = selectedId === p.node.id || selectedId === child.id
          const gc   = getGenColor(p.depth)
          return (
            <path key={`${p.node.id}-${child.id}`}
              d={`M ${p.x} ${p.y + NODE_H} L ${p.x} ${midY} L ${cp.x} ${midY} L ${cp.x} ${cp.y}`}
              stroke={sel ? gc + 'bb' : 'rgba(50,58,72,0.5)'}
              strokeWidth={sel ? 1.5 : 1} fill="none"
              style={{ transition: 'stroke 0.2s' }}
            />
          )
        })
      )}
    </>
  )
}

function NodeCard({ p, selected, isMe, onSelect, showGen = true }: {
  p: Pos; selected: boolean; isMe: boolean; onSelect: (n: ReferralNode) => void; showGen?: boolean
}) {
  const { node } = p
  const rc    = RANK_COLOR[node.rank]    ?? '#64748b'
  const gc    = getGenColor(node.depth)
  const sc    = STATUS_COLOR[node.status] ?? '#64748b'
  const blank = node.status !== 'active'
  const border = selected ? gc : isMe ? 'rgba(77,182,172,0.4)' : blank ? '#f8717133' : 'var(--border-secondary)'
  const bg     = selected ? `${gc}0f`   : isMe ? 'rgba(77,182,172,0.05)' : 'rgba(17,20,27,0.88)'

  return (
    <div onClick={e => { e.stopPropagation(); onSelect(node) }}
      style={{
        position: 'absolute', left: p.x - NODE_W / 2, top: p.y,
        width: NODE_W, height: NODE_H,
        background: bg, border: `1px solid ${border}`,
        borderRadius: 6, padding: '10px 12px', cursor: 'pointer',
        backdropFilter: 'blur(10px)', zIndex: 2, boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column',
        transition: 'border-color 0.2s, transform 0.15s, box-shadow 0.15s',
        userSelect: 'none', opacity: blank ? 0.7 : 1,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = 'translateY(-3px)'
        el.style.boxShadow = '0 10px 28px rgba(0,0,0,0.4)'
        if (!selected) el.style.borderColor = gc + '99'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = ''
        el.style.boxShadow = ''
        if (!selected) el.style.borderColor = border
      }}
    >
      {/* 상단 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>
          {node.node_id}
          {node.ct_id && <span style={{ marginLeft: 5, opacity: 0.5 }}>· {node.ct_id}</span>}
          {isMe && <span style={{ marginLeft: 5, opacity: 0.6 }}>ME</span>}
        </span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {blank && <div style={{ width: 5, height: 5, borderRadius: '50%', background: sc, boxShadow: `0 0 4px ${sc}` }} />}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: rc, background: rc + '22', border: `1px solid ${rc}55`, padding: '1px 6px', borderRadius: 4 }}>{node.rank}</span>
          {showGen && node.depth > 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: gc, background: gc + '18', border: `1px solid ${gc}44`, padding: '1px 5px', borderRadius: 4 }}>
              {node.depth}대
            </span>
          )}
        </div>
      </div>

      {/* 이름 */}
      <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {node.name}
      </div>

      {/* 하단 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 10, marginTop: 'auto' }}>
        {showGen && node.depth > 0 && node.depth <= 4 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: gc, background: gc + '15', border: `1px solid ${gc}33`, padding: '1px 5px', borderRadius: 3 }}>
            {getGenRate(node.depth)} 수당
          </span>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: node.children.length > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
          {node.children.length > 0 ? `↳ ${node.children.length}` : '—'}
        </span>
      </div>
    </div>
  )
}

function DetailPanel({ node, onClose, onNavigate, showGen = true }: {
  node: ReferralNode; onClose: () => void; onNavigate?: (n: ReferralNode) => void; showGen?: boolean
}) {
  const rc = RANK_COLOR[node.rank]    ?? '#64748b'
  const gc = getGenColor(node.depth)
  const sc = STATUS_COLOR[node.status] ?? '#64748b'
  const statusLabel: Record<string, string> = { active: '정상', suspended: '정지', expelled: '제명' }

  return (
    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 280, zIndex: 20, background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.22s cubic-bezier(0.16,1,0.3,1)' }}>
      <style>{`@keyframes slideInRight{from{transform:translateX(40px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>

      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Node Inspector</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#a78bfa' }}>{node.node_id}</div>
        </div>
        <button onClick={onClose} style={{ width: 26, height: 26, border: 'none', background: 'rgba(255,255,255,0.04)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 6, background: rc + '18', border: `1px solid ${rc}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: rc }}>{node.rank}</div>
        <div>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{node.name}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: sc, background: sc + '15', border: `1px solid ${sc}44`, padding: '1px 6px', borderRadius: 3 }}>{statusLabel[node.status] ?? node.status}</span>
            {showGen && node.depth > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: gc, background: gc + '15', border: `1px solid ${gc}44`, padding: '1px 6px', borderRadius: 3 }}>{node.depth}대 · {getGenRate(node.depth)}</span>}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {[
          { label: 'Node ID',     value: node.node_id },
          { label: 'CT ID',       value: node.ct_id || '—' },
          { label: 'MT5',         value: node.mt5_account_id || '—' },
          { label: 'Joined',      value: node.created_at.slice(0, 10) },
          ...(showGen ? [
            { label: 'Generation',  value: node.depth === 0 ? 'Root' : `${node.depth}대` },
            { label: 'Bonus Rate',  value: node.depth > 0 ? (getGenRate(node.depth)) : '—' },
          ] : []),
          { label: 'Direct Refs', value: `${node.children.length}` },
          { label: 'Total Down',  value: `${node.total_count - 1}` },
        ].map((r, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', borderBottom: '1px solid var(--border-primary)' }}>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>{r.label}</span>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 500 }}>{r.value}</span>
          </div>
        ))}

        {node.children.length > 0 && (
          <div style={{ padding: '12px 16px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 }}>
              Direct Referrals ({node.children.length})
            </div>
            {node.children.map((child, i) => {
              const crc = RANK_COLOR[child.rank] ?? '#64748b'
              const cgc = getGenColor(child.depth)
              return (
                <div key={i} onClick={() => onNavigate?.(child)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--bg-inset)', border: '1px solid var(--border-primary)', borderRadius: 4, marginBottom: 6, cursor: onNavigate ? 'pointer' : 'default' }}
                  onMouseEnter={e => { if (onNavigate) (e.currentTarget as HTMLDivElement).style.borderColor = cgc + '66' }}
                  onMouseLeave={e => { if (onNavigate) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-primary)' }}
                >
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: crc, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{child.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>{child.node_id}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: crc, background: crc + '18', border: `1px solid ${crc}44`, padding: '1px 5px', borderRadius: 3 }}>{child.rank}</span>
                    {showGen && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: cgc, background: cgc + '18', border: `1px solid ${cgc}44`, padding: '1px 5px', borderRadius: 3 }}>{child.depth}대</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function ReferralTreeCanvas({
  profileId,
  loading: externalLoading = false,
  isMe = () => false,
  showGenerations = true,
}: {
  profileId: string
  loading?:  boolean        // 부모에서 내려오는 로딩 (프로필 로딩 등)
  isMe?:     (id: string) => boolean
  showGenerations?: boolean // false: 세대(1대/2대)·수당률 표시 숨김 (관리자용)
}) {
  type TreeData = { root: ReferralNode; totalReferrals: number }

  const [data,       setData]       = useState<TreeData | null>(null)
  const [fetching,   setFetching]   = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [selected,   setSelected]   = useState<ReferralNode | null>(null)

  useEffect(() => {
    if (!profileId) { setData(null); setFetchError(null); setFetching(false); return }
    setFetching(true); setFetchError(null); setData(null); setSelected(null)
    fetch(`/api/referral-tree?profileId=${profileId}&depth=4`)
      .then(r => r.json())
      .then(json => { if (json.error) throw new Error(json.error); setData({ root: json.root, totalReferrals: json.totalReferrals }) })
      .catch(e => setFetchError(e?.message ?? '오류'))
      .then(() => setFetching(false), () => setFetching(false))
  }, [profileId])

  const loading = externalLoading || fetching
  const error   = fetchError
  const tree    = data?.root ?? null

  const positions = tree ? layout(tree) : []
  const minX = positions.length ? Math.min(...positions.map(p => p.x - NODE_W / 2)) : 0
  const maxX = positions.length ? Math.max(...positions.map(p => p.x + NODE_W / 2)) : NODE_W
  const minY = positions.length ? Math.min(...positions.map(p => p.y)) : 0
  const maxY = positions.length ? Math.max(...positions.map(p => p.y + NODE_H)) : NODE_H
  const PAD   = 80
  const treeW = maxX - minX + PAD * 2
  const treeH = maxY - minY + PAD * 2
  const ox    = -minX + PAD
  const oy    = -minY + PAD

  const [zoom,    setZoom]    = useState(1)
  const [pan,     setPan]     = useState({ x: 0, y: 0 })
  const [search,  setSearch]  = useState('')
  const isPanning = useRef(false)
  const lastPos   = useRef({ x: 0, y: 0 })
  const canvasRef = useRef<HTMLDivElement>(null)
  const centered  = useRef(false)

  useEffect(() => {
    if (!positions.length || !canvasRef.current || centered.current) return
    centered.current = true
    const r = canvasRef.current.getBoundingClientRect()
    setPan({ x: r.width / 2 - treeW / 2, y: 40 })
  }, [positions.length, treeW])

  useEffect(() => { centered.current = false; setSelected(null) }, [tree])

  const focusNode = useCallback((q: string) => {
    const t = q.trim().toUpperCase()
    const p = positions.find(pos =>
      pos.node.node_id.toUpperCase().includes(t) ||
      pos.node.ct_id.toUpperCase().includes(t)   ||
      pos.node.name.includes(q.trim())
    )
    if (!p || !canvasRef.current) return
    const r  = canvasRef.current.getBoundingClientRect()
    const nx = (p.x + ox) * zoom, ny = (p.y + oy) * zoom
    setPan({ x: r.width / 2 - nx, y: r.height / 2 - ny })
    setSelected(p.node)
  }, [positions, ox, oy, zoom])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const raw = Math.max(-60, Math.min(60, e.deltaY))
    setZoom(z => Math.min(3, Math.max(0.25, z * Math.exp(-raw * 0.006))))
  }, [])
  const handleMouseDown = useCallback((e: React.MouseEvent) => { isPanning.current = true; lastPos.current = { x: e.clientX, y: e.clientY } }, [])
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return
    const dx = e.clientX - lastPos.current.x, dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    setPan(p => ({ x: p.x + dx, y: p.y + dy }))
  }, [])
  const handleMouseUp = useCallback(() => { isPanning.current = false }, [])

  const resetView = () => {
    setZoom(1); centered.current = false
    const el = canvasRef.current
    if (el) setPan({ x: el.getBoundingClientRect().width / 2 - treeW / 2, y: 40 })
  }

  const total    = positions.length
  const maxDepth = positions.length ? Math.max(...positions.map(p => p.depth)) : 0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── 툴바 (BinaryTreeCanvas 와 동일 구조/높이) ── */}
      <div style={{ height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-primary)' }}>
        {!loading && tree && (
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { label: `전체 ${total}`,  color: 'var(--text-secondary)' },
              ...(showGenerations ? [{ label: `${maxDepth}대`, color: '#a78bfa' }] : []),
            ].map((s, i) => (
              <span key={i} style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: s.color, padding: '3px 8px', background: 'var(--bg-inset)', border: '1px solid var(--border-secondary)', borderRadius: 4 }}>{s.label}</span>
            ))}
          </div>
        )}
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2"
            style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') focusNode(search) }}
            placeholder="Node ID / CT / 이름 — Enter"
            style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)', padding: '5px 10px 5px 26px', borderRadius: 4, fontSize: 12, fontFamily: 'var(--font-main)', outline: 'none', width: 200 }}
          />
        </div>
        <button onClick={resetView}
          style={{ padding: '4px 10px', background: 'var(--bg-inset)', border: '1px solid var(--border-secondary)', borderRadius: 4, color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-main)', cursor: 'pointer' }}>
          뷰 리셋
        </button>
      </div>

      {/* ── 캔버스 (BinaryTreeCanvas 와 동일 구조) ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        <div ref={canvasRef}
          style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%,#1a1e26 0%,#0f1115 100%)', cursor: 'grab' }}
          onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
          onClick={() => setSelected(null)}
        >
          {/* 격자 */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(148,163,184,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,0.025) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />

          {/* 로딩 */}
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <div style={{ width: 28, height: 28, border: '2px solid var(--border-secondary)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)' }}>트리 로딩 중...</span>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {/* 에러 */}
          {!loading && error && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ padding: '12px 20px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontFamily: 'var(--font-main)', fontSize: 13, color: '#f87171' }}>{error}</div>
            </div>
          )}

          {/* 빈 상태 — profileId 없음 */}
          {!loading && !error && !profileId && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)' }}>활성 계정이 없습니다</span>
            </div>
          )}

          {/* 빈 상태 — 추천 없음 */}
          {!loading && !error && tree && tree.children.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)' }}>아직 추천한 회원이 없습니다</span>
            </div>
          )}

          {/* 트리 렌더 */}
          {tree && tree.children.length > 0 && (
            <div style={{ position: 'absolute', left: pan.x, top: pan.y, width: treeW, height: treeH, transform: `scale(${zoom})`, transformOrigin: '0 0', transition: 'transform 0.18s cubic-bezier(0.25,0.46,0.45,0.94)' }}>
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', zIndex: 1 }} viewBox={`0 0 ${treeW} ${treeH}`}>
                <Connectors positions={positions.map(p => ({ ...p, x: p.x + ox, y: p.y + oy }))} selectedId={selected?.id ?? null} />
              </svg>
              {positions.map(p => (
                <NodeCard key={p.node.id}
                  p={{ ...p, x: p.x + ox, y: p.y + oy }}
                  selected={selected?.id === p.node.id}
                  isMe={isMe(p.node.id)}
                  onSelect={setSelected}
                  showGen={showGenerations}
                />
              ))}
              {/* 깊이 레이블 */}
              {showGenerations && Array.from({ length: maxDepth + 1 }, (_, d) => {
                const ps = positions.filter(p => p.depth === d)
                if (!ps.length) return null
                const label = d === 0 ? 'Root' : `${d}대 · ${getGenRate(d)}`
                return (
                  <div key={d} style={{ position: 'absolute', left: 0, top: ps[0].y + oy + NODE_H / 2 - 8, fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: getGenColor(d) + '30', pointerEvents: 'none' }}>
                    {label}
                  </div>
                )
              })}
            </div>
          )}

          {/* 줌 % */}
          <div style={{ position: 'absolute', bottom: 14, left: 14, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', background: 'rgba(10,12,16,0.7)', border: '1px solid var(--border-primary)', borderRadius: 4, padding: '3px 7px' }}>
            {Math.round(zoom * 100)}%
          </div>

          {/* 세대 레전드 */}
          {showGenerations && (
          <div style={{ position: 'absolute', bottom: 14, right: selected ? 296 : 14, display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(10,12,16,0.8)', border: '1px solid var(--border-primary)', borderRadius: 6, padding: '6px 12px', transition: 'right 0.22s' }}>
            {Array.from({ length: Math.min(maxDepth + 1, 8) }, (_, d) => {
              const gc  = getGenColor(d)
              const lbl = d === 0 ? 'Root' : `${d}대`
              return (
                <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: gc, boxShadow: `0 0 4px ${gc}` }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: gc }}>{lbl}</span>
                </div>
              )
            })}
          </div>
          )}
        </div>

        {selected && <DetailPanel node={selected} onClose={() => setSelected(null)} onNavigate={setSelected} showGen={showGenerations} />}
      </div>
    </div>
  )
}
