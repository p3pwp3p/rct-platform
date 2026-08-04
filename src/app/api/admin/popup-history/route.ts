/**
 * GET /api/admin/popup-history
 *
 * 관리자가 보낸 회원 팝업의 발송 이력. "발송 건(batch)" 단위로 묶어
 * 누구에게 보냈고 몇 명이 확인했는지 집계한다.
 *
 * 묶는 기준: metadata.batchId (발송 시 서버가 부여).
 *   batchId 가 없는 예전 건은 (제목 + 발송자 + 발송 분(minute)) 로 묶어 표시한다.
 *
 * 응답: { batches: [{ batchId, title, body, sentBy, sentAt,
 *                     recipients, readCount, readRate,
 *                     rows: [{ name, nodeId, readAt }] }] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  if (!token) return false
  const { data } = await admin.auth.getUser(token)
  return data.user?.app_metadata?.role === 'admin'
}

type Row = {
  id: string
  profile_id: string | null
  title: string
  body: string
  read_at: string | null
  created_at: string
  metadata: { sentBy?: string; batchId?: string; sentAt?: string } | null
}

export async function GET(req: NextRequest) {
  try {
    if (!await verifyAdmin(req)) {
      return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
    }

    // 관리자 팝업으로 보낸 알림만. 최근 것부터 넉넉히 가져와 서버에서 묶는다.
    const { data, error } = await admin
      .from('notifications')
      .select('id, profile_id, title, body, read_at, created_at, metadata')
      .eq('metadata->>kind', 'admin_popup')
      .order('created_at', { ascending: false })
      .limit(1000)
    if (error) throw error

    const rows = (data ?? []) as Row[]

    // 수신자 표시용 프로필(노드) 정보
    const profileIds = [...new Set(rows.map(r => r.profile_id).filter((v): v is string => !!v))]
    const profileMap = new Map<string, { node_id: string; name: string }>()
    if (profileIds.length) {
      const { data: profs } = await admin
        .from('profiles').select('id, node_id, name').in('id', profileIds)
      for (const p of (profs ?? [])) profileMap.set(p.id, { node_id: p.node_id, name: p.name })
    }

    type Batch = {
      batchId: string; title: string; body: string
      sentBy: string; sentAt: string
      recipients: number; readCount: number; readRate: number
      rows: { name: string; nodeId: string; readAt: string | null }[]
    }
    const batches = new Map<string, Batch>()

    for (const r of rows) {
      const sentBy = r.metadata?.sentBy ?? '—'
      // batchId 가 없던 예전 건은 제목+발송자+분 단위로 묶어 최대한 한 건처럼 보이게
      const key = r.metadata?.batchId ?? `legacy:${r.title}|${sentBy}|${r.created_at.slice(0, 16)}`

      const cur = batches.get(key) ?? {
        batchId: key,
        title: r.title,
        body: r.body,
        sentBy,
        sentAt: r.metadata?.sentAt ?? r.created_at,
        recipients: 0, readCount: 0, readRate: 0,
        rows: [],
      }
      const p = r.profile_id ? profileMap.get(r.profile_id) : undefined
      cur.recipients += 1
      if (r.read_at) cur.readCount += 1
      cur.rows.push({
        name:   p?.name ?? '(삭제된 회원)',
        nodeId: p?.node_id ?? '—',
        readAt: r.read_at,
      })
      batches.set(key, cur)
    }

    const list = [...batches.values()]
      .map(b => ({
        ...b,
        readRate: b.recipients ? Math.round((b.readCount / b.recipients) * 100) : 0,
        // 안 읽은 사람이 위로 오게 — 후속 안내가 필요한 대상을 먼저 보도록
        rows: b.rows.sort((x, y) => (x.readAt ? 1 : 0) - (y.readAt ? 1 : 0) || x.nodeId.localeCompare(y.nodeId)),
      }))
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt))

    return NextResponse.json({ batches: list })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '조회 오류'
    return NextResponse.json({ error: msg, batches: [] }, { status: 500 })
  }
}
