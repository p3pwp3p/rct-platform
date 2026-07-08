-- ============================================================================
-- 관리자 감사 로그 — 누가·언제·무엇을 했는지 기록
--   (노드 삭제, 수당 계산/지급, 회원 수정 등 민감·파괴적 작업)
-- 조회는 관리자만(RLS), 삽입은 service-role(API)만.
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid,                          -- 행위자(관리자/회원) auth id
  actor_email text,                          -- 행위자 이메일(스냅샷)
  action      text        NOT NULL,          -- 'delete_node' | 'payout_calc' | 'member_update' ...
  target_type text,                          -- 'node' | 'report' | 'account'
  target_id   text,                          -- 대상 식별자(node_id / report_id / profile id)
  detail      jsonb,                         -- 부가 정보
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action  ON admin_audit_log(action);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- 관리자만 조회 (is_admin() 는 app_metadata 기준)
CREATE POLICY "audit_admin_read" ON admin_audit_log FOR SELECT USING (is_admin());
-- INSERT 정책 없음 → service-role(API)만 기록
