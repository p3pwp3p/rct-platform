'use client'
import { useEffect, useState } from 'react'
import { adminGetLegs, type AdminLeg } from '@/lib/db-admin'

const RANK_COLOR: Record<string, string> = {
  'R0': '#64748b', R1: '#34d399', R2: '#60a5fa',
  R3: '#fbbf24', R4: '#f97316', R5: '#a78bfa',
}

function Shimmer() {
  return (
    <div style={{
      height: 13, borderRadius: 4, width: '75%',
      background: 'linear-gradient(90deg, var(--bg-inset) 25%, rgba(148,163,184,0.06) 50%, var(--bg-inset) 75%)',
      backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
    }} />
  )
}

export default function RequestsPage() {
  const [legs, setLegs]     = useState<AdminLeg[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    adminGetLegs()
      .then(rows => {
        // Sort newest first
        const sorted = [...rows].sort((a, b) =>
          new Date(b.profile.created_at).getTime() - new Date(a.profile.created_at).getTime()
        )
        setLegs(sorted)
      })
      .catch(e => setError(e?.message ?? '로딩 오류'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = legs.filter(r =>
    !search ||
    r.profile.name.includes(search) ||
    r.profile.node_id.includes(search.toUpperCase()) ||
    r.profile.referral_code.includes(search.toUpperCase()) ||
    (r.sponsor?.referral_code ?? '').includes(search.toUpperCase())
  )

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .reg-row { transition: background 0.12s; }
        .reg-row:hover { background: rgba(148,163,184,0.03); }
      `}</style>

      <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1600, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, fontFamily: 'var(--font-main)' }}>
              레그 등록 현황
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-main)' }}>
              후원인 코드를 통해 등록된 레그 내역입니다. (최신 순)
            </p>
          </div>

          {!loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 6, background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 5px #34d399' }} />
              <span style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: '#34d399' }}>
                총 {legs.length}건
              </span>
            </div>
          )}
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, fontFamily: 'var(--font-main)', fontSize: 13, color: '#f87171' }}>
            ⚠ {error}
          </div>
        )}

        {/* Search */}
        <div style={{ position: 'relative', maxWidth: 360 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름, 노드ID, 추천코드 검색..."
            style={{ width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 8, paddingBottom: 8, background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-main)', outline: 'none', boxSizing: 'border-box' as const }}
          />
        </div>

        {/* Table */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-header)' }}>
                {['#', '신규 노드', '후원인', '추천인', '레그', '발급 코드', '등록 일시'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontFamily: 'var(--font-main)', color: 'var(--text-tertiary)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j} style={{ padding: '13px 16px' }}><Shimmer /></td>
                      ))}
                    </tr>
                  ))
                : filtered.map((row, i) => {
                    const { profile, sponsor, referrer } = row
                    const sRc  = RANK_COLOR[sponsor?.rank ?? 'R0'] ?? '#64748b'
                    const legColor = profile.leg_position === 'LEFT' ? '#60a5fa' : '#a78bfa'
                    const dt = new Date(profile.created_at)
                    const dateStr = profile.created_at.slice(0, 10)
                    const timeStr = dt.toTimeString().slice(0, 5)

                    return (
                      <tr key={profile.id} className="reg-row"
                        style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border-primary)' : 'none' }}
                      >
                        <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>
                          {String(i + 1).padStart(3, '0')}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600 }}>{profile.node_id}</div>
                          <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{profile.name}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {sponsor ? (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{sponsor.node_id}</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: sRc, background: sRc + '18', border: `1px solid ${sRc}44`, padding: '1px 5px', borderRadius: 3 }}>
                                  {sponsor.rank}
                                </span>
                              </div>
                              <div style={{ fontFamily: 'var(--font-main)', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{sponsor.name}</div>
                            </div>
                          ) : <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>—</span>}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {referrer ? (
                            <div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{referrer.node_id}</div>
                              <div style={{ fontFamily: 'var(--font-main)', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{referrer.name}</div>
                            </div>
                          ) : <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>—</span>}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: legColor, background: legColor + '18', border: `1px solid ${legColor}44`, padding: '2px 8px', borderRadius: 4 }}>
                            {profile.leg_position ?? '—'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#fbbf24', letterSpacing: '0.08em', fontWeight: 700 }}>
                          {profile.referral_code}
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                          {dateStr} <span style={{ opacity: 0.5 }}>{timeStr}</span>
                        </td>
                      </tr>
                    )
                  })
              }
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontFamily: 'var(--font-main)', fontSize: 13 }}>
                    검색 결과가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 범례 */}
        <div style={{ display: 'flex', gap: 24, padding: '8px 0' }}>
          {[
            { label: '후원인', desc: '트리 배치를 결정한 스폰서 (parent_id)' },
            { label: '추천인', desc: '실적 커미션이 귀속되는 소개인 (referrer_id)' },
            { label: '발급 코드', desc: '해당 회원에게 자동 발급된 8자리 추천 코드' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{item.label}</span>
              <span style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)' }}>— {item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
