'use client'
/**
 * ReferralTreeView
 * 추천 트리 (N-ary) 시각화 — 대시보드/어드민 공용
 * props:
 *   profileId  string   — 루트로 볼 profile UUID
 */
import { useEffect, useState, useCallback } from 'react'
import type { ReferralNode } from '@/app/api/referral-tree/route'

const RANK_COLOR: Record<string, string> = {
  R0: '#64748b', R1: '#34d399', R2: '#60a5fa',
  R3: '#fbbf24', R4: '#f97316', R5: '#a78bfa',
}
const LEVEL_COLOR: Record<number, string> = {
  1: '#34d399', 2: '#60a5fa', 3: '#fbbf24', 4: '#f97316',
}
const LEVEL_RATE: Record<number, string> = { 1: '8%', 2: '4%', 3: '4%', 4: '4%' }
const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  active:    { label: '정상', color: '#34d399' },
  suspended: { label: '정지', color: '#fbbf24' },
  expelled:  { label: '제명', color: '#f87171' },
}

const NODE_W = 152

// ─── 노드 카드 ────────────────────────────────────────────────────────────────
function NodeCard({ node, depth, selected, onClick }: {
  node: ReferralNode; depth: number; selected: boolean; onClick: (n: ReferralNode) => void
}) {
  const rc  = RANK_COLOR[node.rank] ?? '#64748b'
  const lc  = LEVEL_COLOR[depth]    ?? 'var(--text-tertiary)'
  const sb  = STATUS_BADGE[node.status]
  const blank = node.status !== 'active'
  return (
    <div onClick={() => onClick(node)}
      style={{
        width: NODE_W, flexShrink: 0, padding: '9px 11px', boxSizing: 'border-box',
        background: selected ? `${lc}14` : blank ? 'rgba(248,113,113,0.04)' : 'var(--bg-surface)',
        border: `1px solid ${selected ? lc + '88' : blank ? '#f8717133' : 'var(--border-primary)'}`,
        borderRadius: 8, cursor: 'pointer', opacity: blank ? 0.65 : 1,
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = lc + '55' }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = blank ? '#f8717133' : 'var(--border-primary)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: rc, background: rc + '18', border: `1px solid ${rc}44`, padding: '1px 5px', borderRadius: 3 }}>{node.rank}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {blank && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: sb.color, background: sb.color + '15', border: `1px solid ${sb.color}44`, padding: '1px 4px', borderRadius: 3 }}>{sb.label}</span>}
          {node.children.length > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)', background: 'var(--bg-inset)', border: '1px solid var(--border-primary)', padding: '1px 4px', borderRadius: 3 }}>+{node.total_count - 1}</span>}
        </div>
      </div>
      <div style={{ fontFamily: 'var(--font-main)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{node.name}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.node_id}</div>
    </div>
  )
}

// ─── 레벨 행 ─────────────────────────────────────────────────────────────────
function LevelRow({ nodes, depth, selectedId, onNodeClick }: {
  nodes: ReferralNode[]; depth: number; selectedId: string | null; onNodeClick: (n: ReferralNode) => void
}) {
  const lc = LEVEL_COLOR[depth] ?? 'var(--text-tertiary)'
  if (!nodes.length) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {/* 레벨 라벨 */}
      <div style={{ width: 110, flexShrink: 0, paddingRight: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: lc + '15', border: `1px solid ${lc}44`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: lc, fontWeight: 700, lineHeight: 1 }}>{LEVEL_RATE[depth]}</span>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: lc }}>{depth}대</div>
            <div style={{ fontFamily: 'var(--font-main)', fontSize: 10, color: 'var(--text-tertiary)' }}>{nodes.length}명</div>
          </div>
        </div>
      </div>
      {/* 구분선 */}
      <div style={{ width: 1, alignSelf: 'stretch', background: lc + '33', flexShrink: 0, margin: '0 14px' }} />
      {/* 노드 목록 */}
      <div style={{ display: 'flex', gap: 7, overflowX: 'auto', flex: 1, paddingBottom: 4, scrollbarWidth: 'thin', scrollbarColor: 'var(--border-secondary) transparent' }}>
        {nodes.map(node => (
          <NodeCard key={node.id} node={node} depth={depth} selected={selectedId === node.id} onClick={onNodeClick} />
        ))}
      </div>
    </div>
  )
}

// ─── 상세 패널 ────────────────────────────────────────────────────────────────
function DetailPanel({ node, onClose }: { node: ReferralNode; onClose: () => void }) {
  const rc = RANK_COLOR[node.rank] ?? '#64748b'
  const lc = LEVEL_COLOR[node.depth] ?? 'var(--text-tertiary)'
  const sb = STATUS_BADGE[node.status]
  return (
    <div style={{ borderLeft: '1px solid var(--border-primary)', width: 260, flexShrink: 0, background: 'var(--bg-surface)', padding: 16, overflowY: 'auto', animation: 'slideIn 0.2s ease' }}>
      <style>{`@keyframes slideIn{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontFamily: 'var(--font-main)', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>노드 상세</span>
        <button onClick={onClose} style={{ width: 22, height: 22, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: rc + '18', border: `1px solid ${rc}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: rc }}>{node.rank}</div>
        <div>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{node.name}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{node.node_id}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: sb.color, background: sb.color + '15', border: `1px solid ${sb.color}44`, padding: '2px 9px', borderRadius: 5 }}>{sb.label}</span>
        {node.depth > 0 && <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: lc, background: lc + '15', border: `1px solid ${lc}44`, padding: '2px 9px', borderRadius: 5 }}>{node.depth}대 · {LEVEL_RATE[node.depth]}</span>}
      </div>
      {[
        { label: '가입일',      value: node.created_at.slice(0, 10), mono: true },
        { label: 'MT5',         value: node.mt5_account_id ?? '미등록', mono: true },
        { label: '직접 추천',    value: `${node.children.length}명`, mono: false },
        { label: '전체 하위',    value: `${node.total_count - 1}명`, mono: false },
      ].map(r => (
        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-primary)' }}>
          <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)' }}>{r.label}</span>
          <span style={{ fontFamily: r.mono ? 'var(--font-mono)' : 'var(--font-main)', fontSize: 12, color: 'var(--text-secondary)' }}>{r.value}</span>
        </div>
      ))}
      {node.children.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 8 }}>직접 추천 ({node.children.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto' }}>
            {node.children.map(c => {
              const crc = RANK_COLOR[c.rank] ?? '#64748b'
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 8px', background: 'var(--bg-inset)', border: '1px solid var(--border-primary)', borderRadius: 6 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: crc, background: crc + '18', border: `1px solid ${crc}44`, padding: '1px 4px', borderRadius: 3 }}>{c.rank}</span>
                  <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  {c.total_count > 1 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>+{c.total_count - 1}</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main export ─────────────────────────────────────────────────────────────
export default function ReferralTreeView({ profileId }: { profileId: string }) {
  type TreeData = {
    root:           ReferralNode
    levelStats:     Record<number, { count: number; rate: number }>
    totalReferrals: number
  }

  const [data,     setData]     = useState<TreeData | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [selected, setSelected] = useState<ReferralNode | null>(null)

  useEffect(() => {
    if (!profileId) return
    setLoading(true); setError(''); setData(null); setSelected(null)
    fetch(`/api/referral-tree?profileId=${profileId}`)
      .then(r => r.json())
      .then(json => { if (json.error) throw new Error(json.error); setData(json) })
      .catch(e => setError(e?.message ?? '오류'))
      .finally(() => setLoading(false))
  }, [profileId])

  const getLevelNodes = useCallback((root: ReferralNode, depth: number): ReferralNode[] => {
    if (depth === 1) return root.children
    const result: ReferralNode[] = []
    function collect(node: ReferralNode, cur: number) {
      if (cur === depth) { result.push(node); return }
      for (const c of node.children) collect(c, cur + 1)
    }
    for (const c of root.children) collect(c, 2)
    return result.filter(n => n.depth === depth)
  }, [])

  const handleClick = useCallback((n: ReferralNode) => {
    setSelected(prev => prev?.id === n.id ? null : n)
  }, [])

  const rc = RANK_COLOR[data?.root.rank ?? 'R0']

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* KPI 바 */}
      {data && (
        <div style={{ height: 44, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-primary)' }}>
          {[1, 2, 3, 4].map(d => {
            const s = data.levelStats[d]; if (!s) return null
            const lc = LEVEL_COLOR[d]
            return (
              <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: lc + '10', border: `1px solid ${lc}30`, borderRadius: 6 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: lc }}>{s.count}</span>
                <span style={{ fontFamily: 'var(--font-main)', fontSize: 10, color: lc }}>{d}대 · {LEVEL_RATE[d]}</span>
              </div>
            )
          })}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: 'var(--bg-inset)', border: '1px solid var(--border-primary)', borderRadius: 6, marginLeft: 'auto' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{data.totalReferrals}</span>
            <span style={{ fontFamily: 'var(--font-main)', fontSize: 10, color: 'var(--text-tertiary)' }}>전체 추천</span>
          </div>
        </div>
      )}

      {/* 본체 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 트리 영역 */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {loading && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-main)', fontSize: 13 }}>
              <div style={{ width: 20, height: 20, border: '2px solid var(--border-secondary)', borderTopColor: '#34d399', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              불러오는 중...
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}
          {error && <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: '#f87171', padding: 16 }}>⚠ {error}</div>}

          {data && !loading && (
            <>
              {/* 루트 행 */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18 }}>
                <div style={{ width: 110, flexShrink: 0, paddingRight: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: rc + '18', border: `1px solid ${rc}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: rc }}>나</div>
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: rc }}>{data.root.rank}</div>
                      <div style={{ fontFamily: 'var(--font-main)', fontSize: 10, color: 'var(--text-tertiary)' }}>루트</div>
                    </div>
                  </div>
                </div>
                <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border-primary)', flexShrink: 0, margin: '0 14px' }} />
                <div style={{ padding: '9px 12px', background: rc + '0d', border: `1px solid ${rc}44`, borderRadius: 8 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: rc }}>{data.root.rank} · {data.root.node_id}</div>
                  <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{data.root.name}</div>
                  <div style={{ fontFamily: 'var(--font-main)', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>직접 추천 {data.root.children.length}명</div>
                </div>
              </div>

              {data.root.children.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '40px 0', color: 'var(--text-tertiary)' }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  <span style={{ fontFamily: 'var(--font-main)', fontSize: 13 }}>아직 추천한 회원이 없습니다</span>
                </div>
              ) : (
                [1, 2, 3, 4].map((depth, di) => {
                  const nodes = getLevelNodes(data.root, depth)
                  if (!nodes.length) return null
                  return (
                    <div key={depth} style={{ animation: `fadeUp 0.25s ease ${di * 60}ms both` }}>
                      <LevelRow nodes={nodes} depth={depth} selectedId={selected?.id ?? null} onNodeClick={handleClick} />
                      {depth < 4 && getLevelNodes(data.root, depth + 1).length > 0 && (
                        <div style={{ marginLeft: 110 + 14 + 8, height: 18, display: 'flex', alignItems: 'center' }}>
                          <div style={{ width: 1, height: '100%', background: `${LEVEL_COLOR[depth + 1]}44`, marginLeft: 16 }} />
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </>
          )}
        </div>

        {/* 상세 패널 */}
        {selected && <DetailPanel node={selected} onClose={() => setSelected(null)} />}
      </div>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}
