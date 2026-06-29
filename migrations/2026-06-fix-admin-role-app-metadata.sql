-- ============================================================================
-- 보안 패치: 관리자 권한 판정을 user_metadata → app_metadata 로 이전
--
-- [취약점] is_admin() 및 모든 verifyAdmin() 가 raw_user_meta_data(user_metadata)
--   의 role 을 신뢰했는데, user_metadata 는 로그인한 사용자가
--   supabase.auth.updateUser({ data: { role: 'admin' } }) 로 직접 수정 가능 →
--   아무 회원이나 스스로 관리자 권한 탈취 가능했음.
-- [수정] app_metadata(raw_app_meta_data, service-role 만 쓰기 가능)로 이전.
--
-- ⚠️ 실행 순서를 반드시 지킬 것. 코드 배포 전에 STEP 1·2 를 먼저 실행해야
--    관리자가 잠기지 않는다.
-- ============================================================================

-- ── STEP 0. (선택) 이미 자가 권한상승한 계정이 있는지 감사 ──────────────────
--   결과에 rctplatformadmin 외의 계정이 um_role='admin' 으로 나오면 침해 의심.
SELECT id, email,
       raw_user_meta_data->>'role' AS um_role,
       raw_app_meta_data->>'role'  AS am_role
FROM auth.users
WHERE raw_user_meta_data->>'role' = 'admin'
   OR raw_app_meta_data->>'role'  = 'admin';

-- ── STEP 1. 정식 관리자 계정에 app_metadata.role='admin' 부여 (코드 배포 前) ──
--   이메일은 실제 관리자 계정으로 교체. 여러 명이면 반복 실행.
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
WHERE email = 'rctplatformadmin@gmail.com';

-- ── STEP 2. is_admin() 가 app_metadata 를 읽도록 교체 (코드 배포 前) ──────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (SELECT (raw_app_meta_data->>'role') = 'admin'
     FROM auth.users WHERE id = auth.uid()),
    false
  );
$$;

-- ── STEP 3. 새 코드 배포 (verifyAdmin/가드가 app_metadata 를 읽음) ───────────
--   여기서 관리자 로그인 → /admin 진입이 정상인지 확인.

-- ── STEP 4. 확인 후, 모든 계정의 user_metadata.role 제거 (잔존 벡터 제거) ─────
--   이미 자가 권한상승한 회원이 있었다면 이 단계에서 무력화됨.
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'role'
WHERE raw_user_meta_data ? 'role';
