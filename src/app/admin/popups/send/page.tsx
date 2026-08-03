'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useApi } from '@/lib/swr'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ToastProvider'

/**
 * 회원 팝업 발송 — 관리자가 쓴 글을 체크한 회원에게만 모달로 띄운다.
 * 대상 선택은 "계정" 단위. 한 계정이 노드를 여러 개 가져도 팝업은 한 번만 떠야 하므로
 * 노드가 아니라 계정을 고르게 했다(서버에서도 계정 단위로 중복 제거).
 */
type Node = { id: string; node_id: string; name: string; status: string }
type Account = {
  id: string; email: string; name: string
  is_admin: boolean; nodes: Node[]
}

export default function SendPopupPage() {
  const showToast = useToast()
  const { data, isLoading } = useApi<{ accounts: Account[] }>('/api/admin/accounts')
  const accounts = useMemo(() => data?.accounts ?? [], [data])

  const [title, setTitle]   = useState('')
  const [body, setBody]     = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [query, setQuery]   = useState('')
  const [busy, setBusy]     = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return accounts
    return accounts.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.nodes.some(n => n.node_id.toLowerCase().includes(q)),
    )
  }, [accounts, query])

  const toggle = (id: string) => setPicked(s => {
    const next = new Set(s)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  // 전체선택은 "지금 보이는 목록" 기준 — 검색으로 좁힌 뒤 일괄 선택하는 흐름
  const allShownPicked = filtered.length > 0 && filtered.every(a => picked.has(a.id))
  const toggleAllShown = () => setPicked(s => {
    const next = new Set(s)
    if (allShownPicked) filtered.forEach(a => next.delete(a.id))
    else filtered.forEach(a => next.add(a.id))
    return next
  })

  const send = async () => {
    if (!title.trim()) { showToast('제목을 입력해주세요', 'error'); return }
    if (picked.size === 0) { showToast('받을 회원을 선택해주세요', 'error'); return }
    if (!confirm(`${picked.size}명에게 팝업을 발송할까요?`)) return

    setBusy(true)
    try {
      // 계정 → 대표 노드 id 로 변환 (서버가 노드 기준으로 수신자를 해석)
      const profileIds = accounts
        .filter(a => picked.has(a.id))
        .map(a => a.nodes[0]?.id)
        .filter((v): v is string => !!v)

      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/send-popup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ title, body, profileIds }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '발송 실패')
      showToast(`${json.sent}명에게 발송했습니다`, 'success')
      setTitle(''); setBody(''); setPicked(new Set())
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '발송 오류', 'error')
    } finally { setBusy(false) }
  }

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'var(--bg-inset)',
    border: '1px solid var(--border-secondary)', borderRadius: 6, color: 'var(--text-primary)',
    fontFamily: 'var(--font-main)', fontSize: 13, padding: '9px 12px', outline: 'none',
  }

  return (
    <div style={{ padding: 32, maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <h1 style={{ fontFamily: 'var(--font-main)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>회원 팝업 발송</h1>
        <Link href="/admin/popups" style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)' }}>
          홈 팝업 관리 →
        </Link>
      </div>
      <p style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24 }}>
        선택한 회원에게만 보이는 공지입니다. 대상이 로그인해 대시보드에 들어오면 모달로 뜨고,
        확인하면 다시 뜨지 않습니다(알림 벨에는 계속 남습니다).
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* 작성 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 18, background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10 }}>
          <div>
            <label style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>제목 *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} style={input} placeholder="예) 8월 정산 안내" maxLength={80} />
          </div>
          <div>
            <label style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>내용</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={9}
              style={{ ...input, resize: 'vertical', lineHeight: 1.6 }} placeholder="회원에게 보여줄 내용을 입력하세요." />
          </div>

          {/* 미리보기 */}
          {(title || body) && (
            <div style={{ marginTop: 4, padding: 14, borderRadius: 10, background: 'var(--bg-inset)', border: '1px dashed var(--border-secondary)' }}>
              {/* 한글 라벨엔 mono + 넓은 자간이 들뜬 것처럼 보여서 SUIT 로 */}
              <div style={{ fontFamily: 'var(--font-main)', fontWeight: 600, fontSize: 11.5, letterSpacing: '-0.01em', color: 'var(--accent-blue, #4db6ac)', marginBottom: 8 }}>미리보기</div>
              <div style={{ fontFamily: 'var(--font-main)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{title || '(제목)'}</div>
              <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{body}</div>
            </div>
          )}

          <button onClick={send} disabled={busy || picked.size === 0 || !title.trim()}
            style={{
              marginTop: 4, padding: '11px 0', borderRadius: 8, border: 'none',
              background: (busy || picked.size === 0 || !title.trim()) ? 'var(--bg-inset)' : 'var(--accent-blue, #4db6ac)',
              color: (busy || picked.size === 0 || !title.trim()) ? 'var(--text-tertiary)' : '#04110f',
              fontFamily: 'var(--font-main)', fontSize: 14, fontWeight: 700,
              cursor: (busy || picked.size === 0 || !title.trim()) ? 'not-allowed' : 'pointer',
            }}>
            {busy ? '발송 중...' : `${picked.size}명에게 발송`}
          </button>
        </div>

        {/* 대상 선택 */}
        <div style={{ padding: 18, background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
              받는 사람 {picked.size > 0 && <span style={{ color: 'var(--accent-blue, #4db6ac)' }}>({picked.size})</span>}
            </span>
            <button onClick={toggleAllShown} style={{ fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-tertiary)', background: 'none', border: '1px solid var(--border-secondary)', borderRadius: 5, padding: '4px 10px', cursor: 'pointer' }}>
              {allShownPicked ? '전체 해제' : '전체 선택'}
            </button>
          </div>

          <input value={query} onChange={e => setQuery(e.target.value)} style={{ ...input, marginBottom: 10 }} placeholder="이름 · 이메일 · 노드ID 검색" />

          <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {isLoading ? (
              <div style={{ padding: 24, textAlign: 'center', fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)' }}>불러오는 중...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)' }}>결과가 없습니다.</div>
            ) : filtered.map(a => {
              const on = picked.has(a.id)
              return (
                <label key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                  background: on ? 'rgba(77,182,172,0.08)' : 'transparent',
                  border: `1px solid ${on ? 'rgba(77,182,172,0.3)' : 'transparent'}`,
                }}>
                  <input type="checkbox" checked={on} onChange={() => toggle(a.id)} style={{ accentColor: '#4db6ac', width: 15, height: 15, cursor: 'pointer' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.name}
                      {a.is_admin && <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)', fontSize: 9, color: '#fbbf24' }}>ADMIN</span>}
                    </div>
                    <div style={{ fontFamily: 'var(--font-main)', fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.email} · 노드 {a.nodes.length}개
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
