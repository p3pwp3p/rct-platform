'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

type Popup = {
  id: string
  title: string
  body: string
  link_url: string | null
  link_label: string | null
  start_at: string
  end_at: string | null
  active: boolean
  created_at: string
}

// datetime-local 값 ↔ ISO 변환
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fromLocalInput(v: string): string | null {
  if (!v) return null
  return new Date(v).toISOString()
}
function fmtRange(start: string, end: string | null): string {
  const f = (iso: string) => new Date(iso).toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  return `${f(start)} ~ ${end ? f(end) : '무기한'}`
}
// 현재 노출 중인지 판정
function isLive(p: Popup): boolean {
  const now = Date.now()
  const startOk = new Date(p.start_at).getTime() <= now
  const endOk = !p.end_at || new Date(p.end_at).getTime() >= now
  return p.active && startOk && endOk
}

type FormState = {
  id: string | null
  title: string
  body: string
  link_url: string
  link_label: string
  start_at: string
  end_at: string
  active: boolean
}
const EMPTY_FORM: FormState = {
  id: null, title: '', body: '', link_url: '', link_label: '',
  start_at: '', end_at: '', active: true,
}

export default function AdminPopupsPage() {
  const [rows, setRows] = useState<Popup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)

  const token = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? ''
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/popups', { headers: { Authorization: `Bearer ${await token()}` } })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '조회 실패')
      setRows(json.popups)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '조회 오류')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const openNew = () => { setForm(EMPTY_FORM); setShowForm(true) }
  const openEdit = (p: Popup) => {
    setForm({
      id: p.id, title: p.title, body: p.body,
      link_url: p.link_url ?? '', link_label: p.link_label ?? '',
      start_at: toLocalInput(p.start_at), end_at: toLocalInput(p.end_at),
      active: p.active,
    })
    setShowForm(true)
  }

  const save = async () => {
    if (!form.title.trim()) { setError('제목은 필수입니다.'); return }
    setBusy(true); setError('')
    try {
      const payload = {
        id: form.id ?? undefined,
        title: form.title, body: form.body,
        link_url: form.link_url, link_label: form.link_label,
        start_at: fromLocalInput(form.start_at),
        end_at: fromLocalInput(form.end_at),
        active: form.active,
      }
      const res = await fetch('/api/admin/popups', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '저장 실패')
      setShowForm(false)
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '저장 오류')
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (p: Popup) => {
    try {
      await fetch('/api/admin/popups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ id: p.id, active: !p.active }),
      })
      await load()
    } catch { /* noop */ }
  }

  const remove = async (p: Popup) => {
    if (!confirm(`"${p.title}" 팝업을 삭제할까요?`)) return
    try {
      await fetch(`/api/admin/popups?id=${p.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${await token()}` },
      })
      await load()
    } catch { /* noop */ }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--bg-inset)', border: '1px solid var(--border-secondary)',
    borderRadius: 6, color: 'var(--text-primary)',
    fontFamily: 'var(--font-main)', fontSize: 13, padding: '9px 12px', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-secondary)',
    display: 'block', marginBottom: 6,
  }

  return (
    <div style={{ padding: 32, maxWidth: 1000 }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontFamily: 'var(--font-main)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>홈페이지 팝업</h1>
        <button onClick={openNew}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 7, border: 'none', background: 'var(--accent-blue)', color: '#000', fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          새 팝업
        </button>
      </div>
      <p style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24 }}>
        홈(로그인 전) 화면에 노출되는 공지 팝업입니다. 노출 기간과 on/off를 설정할 수 있습니다.
      </p>

      {error && (
        <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: '#f87171', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, marginBottom: 16 }}>{error}</div>
      )}

      {/* 목록 */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2].map(i => <div key={i} style={{ height: 70, borderRadius: 10, background: 'linear-gradient(90deg,var(--bg-inset) 25%,rgba(148,163,184,0.06) 50%,var(--bg-inset) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }}/>)}
        </div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', fontFamily: 'var(--font-main)', fontSize: 14, color: 'var(--text-tertiary)', border: '1px dashed var(--border-secondary)', borderRadius: 10 }}>
          등록된 팝업이 없습니다. 새 팝업을 추가하세요.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(p => {
            const live = isLive(p)
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10 }}>
                {/* 상태 뱃지 */}
                <div style={{ flexShrink: 0, width: 64, textAlign: 'center' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
                    color: live ? '#34d399' : 'var(--text-tertiary)',
                    background: live ? 'rgba(52,211,153,0.12)' : 'var(--bg-inset)',
                    border: `1px solid ${live ? 'rgba(52,211,153,0.35)' : 'var(--border-secondary)'}`,
                  }}>{live ? '노출중' : '비노출'}</span>
                </div>
                {/* 내용 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-main)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{fmtRange(p.start_at, p.end_at)}</div>
                </div>
                {/* 액션 */}
                <button onClick={() => toggleActive(p)} title={p.active ? '비활성화' : '활성화'}
                  style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-secondary)', background: 'transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-main)', fontSize: 12, cursor: 'pointer' }}>
                  {p.active ? 'OFF' : 'ON'}
                </button>
                <button onClick={() => openEdit(p)}
                  style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-secondary)', background: 'transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-main)', fontSize: 12, cursor: 'pointer' }}>
                  수정
                </button>
                <button onClick={() => remove(p)}
                  style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#f87171', fontFamily: 'var(--font-main)', fontSize: 12, cursor: 'pointer' }}>
                  삭제
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* 등록/수정 모달 */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div style={{ width: 480, maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 12 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)', fontFamily: 'var(--font-main)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              {form.id ? '팝업 수정' : '새 팝업'}
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>제목 *</label>
                <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="공지 제목" />
              </div>
              <div>
                <label style={labelStyle}>본문</label>
                <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical', fontFamily: 'var(--font-main)' }} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="팝업 본문 내용" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>버튼 링크 (선택)</label>
                  <input style={inputStyle} value={form.link_url} onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))} placeholder="https://..." />
                </div>
                <div>
                  <label style={labelStyle}>버튼 문구 (선택)</label>
                  <input style={inputStyle} value={form.link_label} onChange={e => setForm(f => ({ ...f, link_label: e.target.value }))} placeholder="자세히 보기" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>노출 시작</label>
                  <input type="datetime-local" style={inputStyle} value={form.start_at} onChange={e => setForm(f => ({ ...f, start_at: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>노출 종료 (비우면 무기한)</label>
                  <input type="datetime-local" style={inputStyle} value={form.end_at} onChange={e => setForm(f => ({ ...f, end_at: e.target.value }))} />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
                활성화 (체크 해제 시 기간과 무관하게 숨김)
              </label>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setShowForm(false)} disabled={busy}
                  style={{ flex: 1, padding: '11px', borderRadius: 7, border: '1px solid var(--border-secondary)', background: 'transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-main)', fontSize: 13, cursor: 'pointer' }}>
                  취소
                </button>
                <button onClick={save} disabled={busy || !form.title.trim()}
                  style={{ flex: 2, padding: '11px', borderRadius: 7, border: 'none', background: form.title.trim() ? 'var(--accent-blue)' : 'var(--bg-inset)', color: form.title.trim() ? '#000' : 'var(--text-tertiary)', fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 700, cursor: form.title.trim() ? 'pointer' : 'not-allowed', opacity: busy ? 0.6 : 1 }}>
                  {busy ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
