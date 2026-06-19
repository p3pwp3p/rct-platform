'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

type Term = {
  id: string
  title: string
  body: string
  sort_order: number
  published: boolean
  updated_at: string
  created_at: string
}

type FormState = {
  id: string | null
  title: string
  body: string
  sort_order: string
  published: boolean
}
const EMPTY_FORM: FormState = { id: null, title: '', body: '', sort_order: '0', published: true }

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function AdminTermsPage() {
  const [rows, setRows] = useState<Term[]>([])
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
      const res = await fetch('/api/admin/terms', { headers: { Authorization: `Bearer ${await token()}` } })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '조회 실패')
      setRows(json.terms)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '조회 오류')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const openNew = () => { setForm({ ...EMPTY_FORM, sort_order: String(rows.length) }); setShowForm(true) }
  const openEdit = (t: Term) => {
    setForm({ id: t.id, title: t.title, body: t.body, sort_order: String(t.sort_order), published: t.published })
    setShowForm(true)
  }

  const save = async () => {
    if (!form.title.trim()) { setError('제목은 필수입니다.'); return }
    setBusy(true); setError('')
    try {
      const payload = {
        id: form.id ?? undefined,
        title: form.title, body: form.body,
        sort_order: parseInt(form.sort_order, 10) || 0,
        published: form.published,
      }
      const res = await fetch('/api/admin/terms', {
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

  const togglePublished = async (t: Term) => {
    try {
      await fetch('/api/admin/terms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ id: t.id, published: !t.published }),
      })
      await load()
    } catch { /* noop */ }
  }

  const remove = async (t: Term) => {
    if (!confirm(`"${t.title}" 약관을 삭제할까요?`)) return
    try {
      await fetch(`/api/admin/terms?id=${t.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${await token()}` },
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
    fontFamily: 'var(--font-main)', fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6,
  }

  return (
    <div style={{ padding: 32, maxWidth: 1000 }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontFamily: 'var(--font-main)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>약관 관리</h1>
        <button onClick={openNew}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 7, border: 'none', background: 'var(--accent-blue)', color: '#000', fontFamily: 'var(--font-main)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          새 약관
        </button>
      </div>
      <p style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24 }}>
        이용약관·개인정보 처리방침 등 약관 문서를 카테고리별로 등록·수정합니다. 게시된 약관은 회원가입 화면의 약관 링크(/terms)에서 노출됩니다.
      </p>

      {error && (
        <div style={{ fontFamily: 'var(--font-main)', fontSize: 13, color: '#f87171', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, marginBottom: 16 }}>{error}</div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2].map(i => <div key={i} style={{ height: 64, borderRadius: 10, background: 'linear-gradient(90deg,var(--bg-inset) 25%,rgba(148,163,184,0.06) 50%,var(--bg-inset) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }}/>)}
        </div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', fontFamily: 'var(--font-main)', fontSize: 14, color: 'var(--text-tertiary)', border: '1px dashed var(--border-secondary)', borderRadius: 10 }}>
          등록된 약관이 없습니다. 새 약관을 추가하세요.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 10 }}>
              <div style={{ flexShrink: 0, width: 40, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-tertiary)' }}>#{t.sort_order}</div>
              <div style={{ flexShrink: 0, width: 64, textAlign: 'center' }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
                  color: t.published ? '#34d399' : 'var(--text-tertiary)',
                  background: t.published ? 'rgba(52,211,153,0.12)' : 'var(--bg-inset)',
                  border: `1px solid ${t.published ? 'rgba(52,211,153,0.35)' : 'var(--border-secondary)'}`,
                }}>{t.published ? '게시중' : '미게시'}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-main)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>수정: {fmtDate(t.updated_at)}</div>
              </div>
              <button onClick={() => togglePublished(t)} title={t.published ? '미게시로' : '게시'}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-secondary)', background: 'transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-main)', fontSize: 12, cursor: 'pointer' }}>
                {t.published ? 'OFF' : 'ON'}
              </button>
              <button onClick={() => openEdit(t)}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-secondary)', background: 'transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-main)', fontSize: 12, cursor: 'pointer' }}>
                수정
              </button>
              <button onClick={() => remove(t)}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#f87171', fontFamily: 'var(--font-main)', fontSize: 12, cursor: 'pointer' }}>
                삭제
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 등록/수정 모달 */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div style={{ width: 560, maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 12 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-primary)', fontFamily: 'var(--font-main)', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              {form.id ? '약관 수정' : '새 약관'}
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>제목 *</label>
                <input style={inputStyle} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="예: 이용약관, 개인정보 처리방침" />
              </div>
              <div>
                <label style={labelStyle}>본문</label>
                <textarea style={{ ...inputStyle, minHeight: 220, resize: 'vertical', fontFamily: 'var(--font-main)', lineHeight: 1.6 }} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="약관 전문을 입력하세요. 줄바꿈은 그대로 표시됩니다." />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ width: 120 }}>
                  <label style={labelStyle}>노출 순서</label>
                  <input type="number" style={inputStyle} value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--font-main)', fontSize: 13, color: 'var(--text-secondary)', marginTop: 22 }}>
                  <input type="checkbox" checked={form.published} onChange={e => setForm(f => ({ ...f, published: e.target.checked }))} />
                  게시 (체크 해제 시 숨김)
                </label>
              </div>

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
