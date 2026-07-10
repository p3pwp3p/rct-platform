import { createClient } from '@supabase/supabase-js'

// 알림 발송 전용 service-role 클라이언트 (모듈 싱글턴, RLS 우회)
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export type NotifyInput = {
  profileId: string                       // 알림 대상 프로필(노드)
  type: 'payout' | 'rank_up' | 'system'
  title: string
  body?: string
  metadata?: Record<string, unknown> | null
}

/**
 * 인앱 알림 발송. 대상 프로필의 소유자(owner_id ?? id)를 수신 유저로 해석해 저장.
 * 발송 실패가 본 작업을 막지 않도록 절대 throw 하지 않는다(best-effort).
 */
export async function createNotifications(items: NotifyInput[]): Promise<void> {
  if (items.length === 0) return
  try {
    // 대상 프로필 → 수신 auth 유저 매핑 (owner_id 우선, 없으면 프로필 id 자체가 유저)
    const ids = [...new Set(items.map(i => i.profileId))]
    const { data: profs } = await admin
      .from('profiles')
      .select('id, owner_id')
      .in('id', ids)
    const ownerMap = new Map((profs ?? []).map(p => [p.id, p.owner_id ?? p.id]))

    const rows = items
      .map(i => {
        const userId = ownerMap.get(i.profileId)
        if (!userId) return null              // 소유자 확인 불가 → 스킵
        return {
          user_id:    userId,
          profile_id: i.profileId,
          type:       i.type,
          title:      i.title,
          body:       i.body ?? '',
          metadata:   i.metadata ?? null,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    if (rows.length === 0) return
    const BATCH = 500
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error } = await admin.from('notifications').insert(rows.slice(i, i + BATCH))
      if (error) { console.error('[notify]', error); break }
    }
  } catch (err) {
    console.error('[notify]', err)
  }
}
