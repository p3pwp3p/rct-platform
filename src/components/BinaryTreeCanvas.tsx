'use client'
/**
 * BinaryTreeCanvas
 * 바이너리 후원 트리 캔버스 — 대시보드/어드민 공용
 * props:
 *   tree        NetNode | null   — 렌더할 트리 루트
 *   loading     boolean
 *   error       string | null
 *   isMe?       (nodeId: string) => boolean   — "나" 표시용 (대시보드)
 */
import { useState, useRef, useCallback, useEffect } from 'react'

export interface NetNode {
  id:           string
  nodeId:       string
  ctId:         string
  name:         string
  rank:         string
  sales:        number
  mt5AccountId?: string
  legPosition?: 'LEFT' | 'RIGHT' | null
  joined?:      string
  children:     NetNode[]
}

const RANK_COLOR: Record<string, string> = {
  R0: '#64748b', R1: '#34d399', R2: '#60a5fa',
  R3: '#fbbf24', R4: '#f97316', R5: '#a78bfa',
}

function fmt(n: number) {
  return n > 0 ? n.toLocaleString('ko-KR', { maximumFractionDigits: 0 }) : '—'
}

const NODE_W = 178, NODE_H = 108, H_GAP = 44, V_GAP = 88

interface Pos { node: NetNode; x: number; y: number; depth: number }

function layout(tree: NetNode): Pos[] {
  const out: Pos[] = []
  function w(n: NetNode): number {
    if (!n.children.length) return NODE_W
    return n.children.reduce((s, c) => s + w(c), 0) + H_GAP * (n.children.length - 1)
  }
  function place(n: NetNode, cx: number, ty: number, d: number) {
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
          const cp = byId.get(child.id); if (!cp) return null
          const midY = p.y + NODE_H + V_GAP / 2
          const sel  = selectedId === p.node.id || selectedId === child.id
          const rc   = RANK_COLOR[p.node.rank] ?? '#64748b'
          return (
            <path key={`${p.node.id}-${child.id}`}
              d={`M ${p.x} ${p.y + NODE_H} L ${p.x} ${midY} L ${cp.x} ${midY} L ${cp.x} ${cp.y}`}
              stroke={sel ? rc + 'bb' : 'rgba(50,58,72,0.5)'}
              strokeWidth={sel ? 1.5 : 1} fill="none"
              style={{ transition: 'stroke 0.2s' }}
            />
          )
        })
      )}
    </>
  )
}

function NodeCard({ p, selected, maxSales, isMe, onSelect }: {
  p: Pos; selected: boolean; maxSales: number
  isMe: boolean; onSelect: (n: NetNode) => void
}) {
  const { node } = p
  const rc  = RANK_COLOR[node.rank] ?? '#64748b'
  const bar = node.sales > 0 ? Math.round((node.sales / maxSales) * 100) : 0
  return (
    <div onClick={e => { e.stopPropagation(); onSelect(node) }}
      style={{
        position: 'absolute', left: p.x - NODE_W / 2, top: p.y,
        width: NODE_W, height: NODE_H,
        background: selected ? `${rc}0f` : isMe ? 'rgba(77,182,172,0.05)' : 'rgba(17,20,27,0.88)',
        border: `1px solid ${selected ? rc : isMe ? 'rgba(77,182,172,0.4)' : 'var(--border-secondary)'}`,
        borderRadius: 6, padding: '10px 12px', cursor: 'pointer',
        backdropFilter: 'blur(10px)', zIndex: 2, boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column',
        transition: 'border-color 0.2s, transform 0.15s, box-shadow 0.15s',
        userSelect: 'none',
      }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = 'translateY(-3px)'; el.style.boxShadow = '0 10px 28px rgba(0,0,0,0.4)'; if (!selected) el.style.borderColor = rc + '99' }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = ''; el.style.boxShadow = ''; if (!selected) el.style.borderColor = selected ? rc : isMe ? 'rgba(77,182,172,0.4)' : 'var(--border-secondary)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>
          {node.nodeId}{isMe && <span style={{ marginLeft: 5, opacity: 0.6 }}>ME</span>}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: rc, background: rc + '22', border: `1px solid ${rc}55`, padding: '1px 6px', borderRadius: 4 }}>{node.rank}</span>
      </div>
      <div style={{ marginBottom: 'auto', minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          MT5 <span style={{ color: node.mt5AccountId ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>{node.mt5AccountId || '—'}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 10, marginTop: 'auto' }}>
        <div style={{ flex: 1, height: 2, background: 'var(--border-primary)', borderRadius: 1 }}>
          <div style={{ height: '100%', width: `${bar}%`, background: rc, borderRadius: 1, transition: 'width 0.4s' }} />
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: node.sales > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)', minWidth: 30, textAlign: 'right' }}>{fmt(node.sales)}</span>
      </div>
    </div>
  )
}

function DetailPanel({ node, onClose, onNavigate }: { node: NetNode; onClose: () => void; onNavigate?: (n: NetNode) => void }) {
  const rc = RANK_COLOR[node.rank] ?? '#64748b'
  return (
    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 280, zIndex: 20, background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.22s cubic-bezier(0.16,1,0.3,1)' }}>
      <style>{`@keyframes slideInRight{from{transform:translateX(40px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Node Inspector</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-blue)' }}>{node.nodeId}</div>
        </div>
        <button onClick={onClose} style={{ width: 26, height: 26, border: 'none', background: 'rgba(255,255,255,0.04)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 6, background: rc + '18', border: `1px solid ${rc}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: rc }}>{node.rank}</div>
        <div>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{node.name}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{node.nodeId}</div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {[
          { label: 'CT ID',   value: node.ctId || '—',           mono: true },
          { label: 'MT5',     value: node.mt5AccountId || '—',   mono: true },
          { label: 'PV',      value: fmt(node.sales),             mono: true },
          { label: 'Joined',  value: node.joined ? node.joined.slice(0, 10) : '—', mono: true },
          { label: 'Leg',     value: node.legPosition || '—',     mono: true },
          { label: 'Sub Legs',value: `${node.children.length}개`, mono: true },
        ].map((r, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '9px 16px', borderBottom: '1px solid var(--border-primary)' }}>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', flexShrink: 0, whiteSpace: 'nowrap' }}>{r.label}</span>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 500, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.value}</span>
          </div>
        ))}
        {node.children.length > 0 && (
          <div style={{ padding: '12px 16px' }}>
            <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 8 }}>직속 레그 ({node.children.length})</div>
            {node.children.map((child, i) => {
              const crc = RANK_COLOR[child.rank] ?? '#64748b'
              return (
                <div key={i} onClick={() => onNavigate?.(child)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--bg-inset)', border: '1px solid var(--border-primary)', borderRadius: 4, marginBottom: 6, cursor: onNavigate ? 'pointer' : 'default' }}
                  onMouseEnter={e => { if (onNavigate) (e.currentTarget as HTMLDivElement).style.borderColor = crc + '66' }}
                  onMouseLeave={e => { if (onNavigate) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-primary)' }}
                >
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: crc, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{child.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>{child.nodeId}</div>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: crc, background: crc + '18', border: `1px solid ${crc}44`, padding: '1px 5px', borderRadius: 3 }}>{child.rank}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main export ─────────────────────────────────────────────────────────────
export default function BinaryTreeCanvas({
  tree, loading, error,
  isMe = () => false,
}: {
  tree:    NetNode | null
  loading: boolean
  error:   string | null
  isMe?:   (id: string) => boolean
}) {
  const positions = tree ? layout(tree) : []
  const maxSales  = Math.max(...positions.map(p => p.node.sales), 1)

  const minX = positions.length ? Math.min(...positions.map(p => p.x - NODE_W / 2)) : 0
  const maxX = positions.length ? Math.max(...positions.map(p => p.x + NODE_W / 2)) : NODE_W
  const minY = positions.length ? Math.min(...positions.map(p => p.y)) : 0
  const maxY = positions.length ? Math.max(...positions.map(p => p.y + NODE_H)) : NODE_H
  const PAD  = 80
  const treeW = maxX - minX + PAD * 2
  const treeH = maxY - minY + PAD * 2
  const ox    = -minX + PAD, oy = -minY + PAD

  const [zoom, setZoom]         = useState(1)
  const [pan,  setPan]          = useState({ x: 0, y: 0 })
  const [selected, setSelected] = useState<NetNode | null>(null)
  const [search, setSearch]     = useState('')
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

  // reset center when tree changes
  useEffect(() => { centered.current = false; setSelected(null) }, [tree])

  const focusNode = useCallback((q: string) => {
    const p = positions.find(pos =>
      pos.node.nodeId.includes(q) || pos.node.ctId.includes(q) || pos.node.name.includes(q)
    )
    if (!p || !canvasRef.current) return
    const r  = canvasRef.current.getBoundingClientRect()
    const nx = (p.x + ox) * zoom, ny = (p.y + oy) * zoom
    setPan({ x: r.width / 2 - nx, y: r.height / 2 - ny })
    setSelected(p.node)
  }, [positions, ox, oy, zoom])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const factor = Math.exp(-Math.max(-150, Math.min(150, e.deltaY)) * 0.0015)
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    setZoom(oldZ => {
      const newZ = Math.min(3, Math.max(0.25, oldZ * factor))
      setPan(p => ({ x: mx - (mx - p.x) * (newZ / oldZ), y: my - (my - p.y) * (newZ / oldZ) }))
      return newZ
    })
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
    setZoom(1)
    centered.current = false
    const el = canvasRef.current
    if (el) setPan({ x: el.getBoundingClientRect().width / 2 - treeW / 2, y: 40 })
  }

  const total    = positions.length
  const maxDepth = positions.length ? Math.max(...positions.map(p => p.depth)) : 0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 툴바 */}
      <div style={{ height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-primary)' }}>
        {!loading && (
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { label: `전체 ${total}`,    color: 'var(--text-secondary)' },
              { label: `깊이 ${maxDepth}`, color: 'var(--accent-blue)' },
            ].map((s, i) => (
              <span key={i} style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: s.color, padding: '3px 8px', background: 'var(--bg-inset)', border: '1px solid var(--border-secondary)', borderRadius: 4 }}>{s.label}</span>
            ))}
          </div>
        )}
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') focusNode(search) }}
            placeholder="Node ID / 이름 / CT — Enter"
            style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)', padding: '5px 10px 5px 26px', borderRadius: 4, fontSize: 13, fontFamily: 'var(--font-main)', outline: 'none', width: 220 }}
          />
        </div>
        <button onClick={resetView} style={{ padding: '4px 10px', background: 'var(--bg-inset)', border: '1px solid var(--border-secondary)', borderRadius: 4, color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'var(--font-main)', cursor: 'pointer' }}>뷰 리셋</button>
      </div>

      {/* 캔버스 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        <div ref={canvasRef}
          style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%,#1a1e26 0%,#0f1115 100%)', cursor: 'grab' }}
          onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onClick={() => setSelected(null)}
        >
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(148,163,184,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,0.025) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />

          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <div style={{ width: 28, height: 28, border: '2px solid var(--border-secondary)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)' }}>트리 로딩 중...</span>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}
          {!loading && error && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ padding: '12px 20px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontFamily: 'var(--font-main)', fontSize: 13, color: '#f87171' }}>{error}</div>
            </div>
          )}
          {!loading && !error && !tree && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5"><path d="M12 2v6M12 22v-6M12 8a4 4 0 0 1-4 4H4M12 8a4 4 0 0 0 4 4h4M12 16a4 4 0 0 1-4-4H4M12 16a4 4 0 0 0 4-4h4"/></svg>
              <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)' }}>아직 하위 네트워크가 없습니다</span>
            </div>
          )}

          {tree && (
            <div style={{ position: 'absolute', left: pan.x, top: pan.y, width: treeW, height: treeH, transform: `scale(${zoom})`, transformOrigin: '0 0', transition: 'none', willChange: 'transform' }}>
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', zIndex: 1 }} viewBox={`0 0 ${treeW} ${treeH}`}>
                <Connectors positions={positions.map(p => ({ ...p, x: p.x + ox, y: p.y + oy }))} selectedId={selected?.id ?? null} />
              </svg>
              {positions.map(p => (
                <NodeCard key={p.node.id} p={{ ...p, x: p.x + ox, y: p.y + oy }}
                  selected={selected?.id === p.node.id} maxSales={maxSales}
                  isMe={isMe(p.node.id)} onSelect={setSelected}
                />
              ))}
              {Array.from({ length: maxDepth + 1 }, (_, d) => {
                const ps = positions.filter(p => p.depth === d)
                if (!ps.length) return null
                return <div key={d} style={{ position: 'absolute', left: 0, top: ps[0].y + oy + NODE_H / 2 - 8, fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(148,163,184,0.18)', pointerEvents: 'none' }}>D{d}</div>
              })}
            </div>
          )}

          <div style={{ position: 'absolute', bottom: 14, left: 14, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', background: 'rgba(10,12,16,0.7)', border: '1px solid var(--border-primary)', borderRadius: 4, padding: '3px 7px' }}>{Math.round(zoom * 100)}%</div>
          <div style={{ position: 'absolute', bottom: 14, right: selected ? 296 : 14, display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(10,12,16,0.8)', border: '1px solid var(--border-primary)', borderRadius: 6, padding: '6px 12px', transition: 'right 0.22s' }}>
            {Object.entries(RANK_COLOR).map(([rank, color]) => (
              <div key={rank} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 4px ${color}` }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color }}>{rank}</span>
              </div>
            ))}
          </div>
        </div>
        {selected && <DetailPanel node={selected} onClose={() => setSelected(null)} onNavigate={setSelected} />}
      </div>
    </div>
  )
}
