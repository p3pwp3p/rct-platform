/**
 * GET /api/cron/enforce-grace
 *
 * 유예기간이 만료된 노드를 정지 처리한다. (서버측 정기 실행 — Vercel Cron)
 *
 * 왜 필요한가:
 *   유예 만료 → 정지 전환은 원래 planEnforcement 안에 있고, 그건 직원 PC 의
 *   vantage-sync 가 매시간 /api/admin/import-copiers 를 호출할 때만 돈다.
 *   그 PC 가 꺼져 있으면 유예가 만료돼도 계속 "정지 예정"으로 방치된다.
 *   이 라우트는 그 경우의 안전망이다.
 *
 * 판정 근거:
 *   pending_action='suspend' + grace_until <= now + status='active'.
 *   즉 "마지막 동기화 시점에 한도 초과라 예고를 받았고, 유예가 끝난" 노드.
 *   증거금을 보충했다면 그 다음 동기화에서 grace_cancel 로 예고가 풀렸을 것이므로
 *   아직 예고가 남아 있다는 건 (시스템이 아는 한) 보충되지 않았다는 뜻이다.
 *   보충 후 정지된 경우엔 다음 동기화의 reactivate 로 자동 복구된다.
 *
 * 인증: Vercel Cron 이 보내는 `Authorization: Bearer $CRON_SECRET`.
 *       CRON_SECRET 이 없으면 외부에서 부를 수 없도록 항상 거부한다.
 *
 * 킬스위치: CRON_ENFORCE_ENABLED='true' 일 때만 실제로 정지시킨다.
 *   기본값이 "꺼짐"인 이유 — 정식 오픈 전이라 노드 데이터가 정리되지 않은
 *   상태에서 자동 정지가 돌면 회원 노드가 의도치 않게 멈춘다.
 *   운영 준비가 끝나면 Vercel 환경변수에 CRON_ENFORCE_ENABLED=true 를 넣을 것.
 *
 * 스케줄(vercel.json): "17 18 * * *" = UTC 18:17 = KST 03:17, 하루 1회.
 *   Vercel Hobby 플랜은 cron 을 하루 1회만 허용해서 이렇게 맞춰뒀다.
 *   Pro 로 올리면 "17 * * * *"(매시) 로 바꾸면 된다 — 유예 만료 후 정지까지의
 *   지연이 최대 24시간에서 최대 1시간으로 줄어든다.
 *   (유예기간이 7일이라 하루 1회로도 실무상 문제는 없다)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createNotifications } from '@/lib/notify'
import { logAudit } from '@/lib/audit'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  // 시크릿 미설정이면 잠가둔다 — 설정 누락이 곧 공개 엔드포인트가 되지 않도록
  if (!secret) return false
  const got = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  return got === secret
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  }

  // 킬스위치 — 켜지 않은 동안엔 조회조차 하지 않고 그대로 반환(부수효과 0)
  if (process.env.CRON_ENFORCE_ENABLED !== 'true') {
    return NextResponse.json({
      ok: true, skipped: true, reason: 'CRON_ENFORCE_ENABLED 미설정 — 자동 정지 비활성',
      checkedAt: new Date().toISOString(),
    })
  }

  try {
    const nowIso = new Date().toISOString()

    // 유예 만료 + 아직 활성인 노드
    const { data: expired, error } = await admin
      .from('profiles')
      .select('id, node_id, name, grace_until, pending_reason')
      .eq('status', 'active')
      .eq('pending_action', 'suspend')
      .not('grace_until', 'is', null)
      .lte('grace_until', nowIso)
    if (error) throw error

    if (!expired?.length) {
      return NextResponse.json({ ok: true, suspended: 0, checkedAt: nowIso })
    }

    // 정지 전환 — planEnforcement 의 'suspend' 분기와 같은 필드 세트
    const ids = expired.map(n => n.id)
    const { error: upErr } = await admin
      .from('profiles')
      .update({ status: 'suspended', pending_action: null, grace_until: null, pending_reason: null })
      .in('id', ids)
    if (upErr) throw upErr

    // 인앱 알림 (best-effort — 실패해도 정지는 유지)
    await createNotifications(expired.map(n => ({
      profileId: n.id,
      type: 'system' as const,
      title: `${n.node_id} 노드가 정지되었습니다`,
      body: '증거금 미충족으로 정지됨. 증거금 보충 시 자동 해제됩니다.',
      metadata: { reason: n.pending_reason ?? null, via: 'cron' },
    })))

    await logAudit({
      actorEmail: 'system(cron)', action: 'node_grace_expired_suspend',
      targetType: 'node', targetId: expired.map(n => n.node_id).join(','),
      detail: { count: ids.length, nodeIds: expired.map(n => n.node_id), checkedAt: nowIso },
    })

    return NextResponse.json({
      ok: true,
      suspended: ids.length,
      nodeIds: expired.map(n => n.node_id),
      checkedAt: nowIso,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '유예 만료 처리 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
