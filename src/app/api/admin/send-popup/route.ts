/**
 * POST /api/admin/send-popup
 *
 * 관리자가 작성한 글을 지정한 회원에게 "팝업 알림"으로 발송.
 *
 * body: { title: string, body?: string, profileIds: string[] }
 *   profileIds = 대상 노드(프로필) id 목록. 실제 수신자는 그 노드의 소유 계정으로
 *   해석된다(notify.createNotifications 가 owner_id ?? id 로 처리).
 *
 * 같은 계정이 노드를 여러 개 가진 경우 한 번만 받도록 계정 단위로 중복을 제거한다.
 * (노드마다 팝업이 뜨면 같은 글을 여러 번 닫아야 해서)
 *
 * "팝업으로 띄울 알림"이라는 표시는 스키마 변경 없이 metadata.kind='admin_popup' 로 한다.
 * 컬럼을 추가하면 마이그레이션이 배포보다 늦을 때 알림 조회 자체가 깨지므로 의도적으로 피함.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, clientIp, tooMany } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function adminUser(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  if (!token) return null
  const { data } = await admin.auth.getUser(token)
  return data.user?.app_metadata?.role === 'admin' ? data.user : null
}

export async function POST(req: NextRequest) {
  try {
    const actor = await adminUser(req)
    if (!actor) return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })

    if (!await rateLimit(`send-popup:${clientIp(req)}`, 20, 60)) {
      return NextResponse.json(tooMany, { status: 429 })
    }

    const { title, body, profileIds } = await req.json().catch(() => ({}))
    if (typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: '제목을 입력해주세요.' }, { status: 400 })
    }
    if (!Array.isArray(profileIds) || profileIds.length === 0) {
      return NextResponse.json({ error: '받을 회원을 한 명 이상 선택해주세요.' }, { status: 400 })
    }

    // 대상 노드 → 수신 계정(owner_id ?? id) 해석 후 계정 단위로 중복 제거
    const { data: profs, error: pErr } = await admin
      .from('profiles')
      .select('id, node_id, name, owner_id')
      .in('id', profileIds)
    if (pErr) throw pErr
    if (!profs?.length) {
      return NextResponse.json({ error: '대상 회원을 찾을 수 없습니다.' }, { status: 400 })
    }

    // 계정당 대표 노드 1개만 남김 — 같은 글을 여러 번 닫게 하지 않기 위해
    const byAccount = new Map<string, { profileId: string; nodeId: string; name: string }>()
    for (const p of profs) {
      const account = p.owner_id ?? p.id
      if (!byAccount.has(account)) {
        byAccount.set(account, { profileId: p.id, nodeId: p.node_id, name: p.name })
      }
    }

    const rows = [...byAccount.entries()].map(([userId, p]) => ({
      user_id:    userId,
      profile_id: p.profileId,
      type:       'system',
      title:      title.trim(),
      body:       typeof body === 'string' ? body.trim() : '',
      metadata:   { sentBy: actor.email ?? null, kind: 'admin_popup' },
    }))

    const { error: insErr } = await admin.from('notifications').insert(rows)
    if (insErr) throw insErr

    await logAudit({
      actorId: actor.id, actorEmail: actor.email, action: 'admin_popup_send',
      targetType: 'account', targetId: `${rows.length}명`,
      detail: {
        title: title.trim(),
        recipients: rows.length,
        selectedNodes: profs.length,
        nodeIds: [...byAccount.values()].map(v => v.nodeId),
      },
    })

    return NextResponse.json({
      ok: true,
      sent: rows.length,
      selectedNodes: profs.length,
      // 노드 여러 개를 골랐어도 계정 기준으로 합쳐졌음을 UI 에서 알려주기 위해
      mergedByAccount: profs.length - rows.length,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '발송 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
