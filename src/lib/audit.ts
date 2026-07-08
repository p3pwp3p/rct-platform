import { createClient } from '@supabase/supabase-js'

// 감사 로그 전용 service-role 클라이언트 (모듈 싱글턴)
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export type AuditEntry = {
  actorId?:    string | null
  actorEmail?: string | null
  action:      string
  targetType?: string | null
  targetId?:   string | null
  detail?:     Record<string, unknown> | null
}

/**
 * 관리자/민감 작업을 감사 로그에 기록.
 * 로깅 실패가 본 작업을 막지 않도록 절대 throw 하지 않는다(best-effort).
 */
export async function logAudit(e: AuditEntry): Promise<void> {
  try {
    await admin.from('admin_audit_log').insert({
      actor_id:    e.actorId ?? null,
      actor_email: e.actorEmail ?? null,
      action:      e.action,
      target_type: e.targetType ?? null,
      target_id:   e.targetId ?? null,
      detail:      e.detail ?? null,
    })
  } catch (err) {
    console.error('[audit]', err)
  }
}
