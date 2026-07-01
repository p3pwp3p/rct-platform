-- =============================================================
-- Aetheris RCT Platform — Schema
-- Run this in the Supabase SQL editor (once, on a fresh database)
-- =============================================================

-- Enable UUID / crypto extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- Sequences
-- =============================================================
CREATE SEQUENCE IF NOT EXISTS node_seq    START 100     INCREMENT 1;

-- =============================================================
-- profiles
-- =============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id              uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  node_id         text        UNIQUE NOT NULL DEFAULT '',   -- e.g. 'RCT-00125'
  name            text        NOT NULL DEFAULT '',
  rank            text        NOT NULL DEFAULT 'R0'
                              CHECK (rank IN ('R0','R1','R2','R3','R4','R5')),
  referral_code   char(8)     UNIQUE NOT NULL DEFAULT '',
  sales           numeric     NOT NULL DEFAULT 0,
  parent_id       uuid        REFERENCES profiles(id),
  leg_position    text        CHECK (leg_position IN ('LEFT','RIGHT')),
  owner_id        uuid        REFERENCES auth.users(id),
  referrer_id     uuid        REFERENCES profiles(id),
  trc20_address   text,                                    -- Tether TRC-20 출금 지갑 주소
  mt5_account_id  text,                                    -- Vantage MT5 계좌 ID
  status          text        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','suspended','expelled')),
  vantage_ack     boolean     NOT NULL DEFAULT false,        -- Vantage 가입 안내 모달 확인 여부 (계정당 1회)
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- =============================================================
-- Trigger: auto-generate node_id / referral_code
-- =============================================================
CREATE OR REPLACE FUNCTION handle_new_profile()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code  text := '';
  i     int;
BEGIN
  -- node_id: 시퀀스가 수동 INSERT 등으로 뒤처져도 충돌하지 않도록
  -- 사용 중이 아닌 번호가 나올 때까지 nextval 을 반복한다.
  IF NEW.node_id IS NULL OR NEW.node_id = '' THEN
    LOOP
      NEW.node_id := 'RCT-' || LPAD(nextval('node_seq')::text, 5, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE node_id = NEW.node_id);
    END LOOP;
  END IF;

  -- referral_code: random 8-char from safe charset, guaranteed unique
  IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
    LOOP
      code := '';
      FOR i IN 1..8 LOOP
        code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE referral_code = code);
    END LOOP;
    NEW.referral_code := code;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER before_insert_profile
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_profile();

-- =============================================================
-- rank_history
-- =============================================================
CREATE TABLE IF NOT EXISTS rank_history (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  old_rank    text        NOT NULL,
  new_rank    text        NOT NULL,
  changed_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================================
-- Row Level Security
-- =============================================================
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_history ENABLE ROW LEVEL SECURITY;

-- profiles: 자신의 row + owner_id가 자신인 row (아바타 계좌) 읽기 허용
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id OR auth.uid() = owner_id);

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id OR auth.uid() = owner_id);

-- rank_history: each user can only read their own history
CREATE POLICY "rh_select_own"
  ON rank_history FOR SELECT
  USING (profile_id = auth.uid());

-- =============================================================
-- Admin policies (role = 'admin' in auth.users app_metadata)
-- =============================================================
-- Helper: is the current user an admin?
-- 주의: role 은 raw_app_meta_data(app_metadata)에서 읽는다.
-- raw_user_meta_data(user_metadata)는 사용자가 supabase.auth.updateUser({data})로
-- 직접 수정 가능하므로 권한 판정에 쓰면 자가 권한상승 취약점이 된다.
-- app_metadata 는 service-role 만 쓸 수 있어 안전하다.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (SELECT (raw_app_meta_data->>'role') = 'admin'
     FROM auth.users WHERE id = auth.uid()),
    false
  );
$$;

-- profiles: admin can read / update ALL rows
CREATE POLICY "profiles_admin_select"
  ON profiles FOR SELECT
  USING (is_admin());

CREATE POLICY "profiles_admin_update"
  ON profiles FOR UPDATE
  USING (is_admin());

CREATE POLICY "profiles_admin_insert"
  ON profiles FOR INSERT
  WITH CHECK (is_admin());

-- rank_history: admin can read all
CREATE POLICY "rh_admin_select"
  ON rank_history FOR SELECT
  USING (is_admin());

-- =============================================================
-- Function: get_downline  (recursive CTE — all descendants)
-- =============================================================
CREATE OR REPLACE FUNCTION get_downline(root_id uuid)
RETURNS TABLE (
  id              uuid,
  node_id         text,
  referral_code   text,
  mt5_account_id  text,
  name            text,
  rank            text,
  status          text,
  sales           numeric,
  parent_id       uuid,
  leg_position    text,
  trc20_address   text,
  referrer_id     uuid,
  created_at      timestamptz,
  depth           int
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH RECURSIVE tree AS (
    SELECT p.id, p.node_id, p.referral_code, p.mt5_account_id, p.name, p.rank, p.status, p.sales,
           p.parent_id, p.leg_position, p.trc20_address, p.referrer_id, p.created_at, 0 AS depth
    FROM profiles p
    WHERE p.id = root_id

    UNION ALL

    SELECT c.id, c.node_id, c.referral_code, c.mt5_account_id, c.name, c.rank, c.status, c.sales,
           c.parent_id, c.leg_position, c.trc20_address, c.referrer_id, c.created_at, t.depth + 1
    FROM profiles c
    JOIN tree t ON c.parent_id = t.id
  )
  SELECT * FROM tree;
$$;

-- =============================================================
-- status_history  (회원 정지/복구/제명 이력)
-- =============================================================
CREATE TABLE IF NOT EXISTS status_history (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  old_status  text        NOT NULL,
  new_status  text        NOT NULL,
  reason      text,
  changed_by  uuid        REFERENCES auth.users(id),
  changed_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sh_admin_all"
  ON status_history FOR ALL
  USING (is_admin());

CREATE POLICY "sh_select_own"
  ON status_history FOR SELECT
  USING (profile_id = auth.uid());

-- =============================================================
-- profit_reports  (Vantage 복사기 이익 공유 보고서 헤더)
-- =============================================================
CREATE TABLE IF NOT EXISTS profit_reports (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid        REFERENCES profiles(id) ON DELETE SET NULL,  -- nullable: 미매칭 보고서 허용
  date_from    date        NOT NULL,
  date_to      date        NOT NULL,
  total_unpaid numeric     NOT NULL DEFAULT 0,
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','confirmed','paid','failed')),
  uploaded_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profit_reports ENABLE ROW LEVEL SECURITY;

-- 본인 프로필 + 본인이 owner_id인 관리형 프로필 모두 허용
CREATE POLICY "pr_select_own"
  ON profit_reports FOR SELECT
  USING (
    profile_id IN (
      SELECT id FROM profiles
      WHERE id = auth.uid() OR owner_id = auth.uid()
    )
  );

CREATE POLICY "pr_insert_own"
  ON profit_reports FOR INSERT
  WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles
      WHERE id = auth.uid() OR owner_id = auth.uid()
    )
  );

CREATE POLICY "pr_admin_all"
  ON profit_reports FOR ALL
  USING (is_admin());

-- =============================================================
-- profit_report_items  (보고서 내 전략별 명세)
-- =============================================================
CREATE TABLE IF NOT EXISTS profit_report_items (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id            uuid        NOT NULL REFERENCES profit_reports(id) ON DELETE CASCADE,
  mt5_account_id       text        NOT NULL,
  strategy_name        text,
  date_from            date,
  date_to              date,
  distributable_income numeric     NOT NULL DEFAULT 0,
  profit_ratio         numeric     NOT NULL DEFAULT 0,
  unpaid_profit        numeric     NOT NULL DEFAULT 0,
  matched_profile_id   uuid        REFERENCES profiles(id),
  matched_node_id      text,
  matched_name         text,
  trc20_address        text
);

ALTER TABLE profit_report_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pri_select_own"
  ON profit_report_items FOR SELECT
  USING (
    report_id IN (
      SELECT id FROM profit_reports
      WHERE profile_id IN (
        SELECT id FROM profiles WHERE id = auth.uid() OR owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "pri_insert_own"
  ON profit_report_items FOR INSERT
  WITH CHECK (
    report_id IN (
      SELECT id FROM profit_reports
      WHERE profile_id IN (
        SELECT id FROM profiles WHERE id = auth.uid() OR owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "pri_admin_all"
  ON profit_report_items FOR ALL
  USING (is_admin());

-- =============================================================
-- csv_export_logs  (관리자 CSV 내보내기 이력)
-- =============================================================
CREATE TABLE IF NOT EXISTS csv_export_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  exported_at   timestamptz NOT NULL DEFAULT now(),
  report_count  int         NOT NULL DEFAULT 0,
  total_amount  numeric     NOT NULL DEFAULT 0,
  report_ids    uuid[]      NOT NULL DEFAULT '{}',
  note          text
);

ALTER TABLE csv_export_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cel_admin_all"
  ON csv_export_logs FOR ALL
  USING (is_admin());

-- =============================================================
-- payout_distributions  (수당 계산 결과 — 수령인별 행)
-- =============================================================
CREATE TABLE IF NOT EXISTS payout_distributions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id    uuid        NOT NULL REFERENCES profit_reports(id) ON DELETE CASCADE,
  source_id    uuid        NOT NULL REFERENCES profiles(id),   -- 수익 발생 원천 노드
  recipient_id uuid        NOT NULL REFERENCES profiles(id),   -- 수당 수령 노드
  bonus_type   text        NOT NULL CHECK (bonus_type IN ('referral','rank','sponsor')),
  amount       numeric     NOT NULL DEFAULT 0,
  rate         numeric     NOT NULL DEFAULT 0,
  generation   int         NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pd_report    ON payout_distributions(report_id);
CREATE INDEX IF NOT EXISTS idx_pd_recipient ON payout_distributions(recipient_id);
CREATE INDEX IF NOT EXISTS idx_pd_bonus_type ON payout_distributions(bonus_type);

ALTER TABLE payout_distributions ENABLE ROW LEVEL SECURITY;

-- 본인 프로필 + 관리형 프로필이 수령인인 행 읽기 허용
CREATE POLICY "pd_select_own"
  ON payout_distributions FOR SELECT
  USING (
    recipient_id IN (
      SELECT id FROM profiles
      WHERE id = auth.uid() OR owner_id = auth.uid()
    )
  );

CREATE POLICY "pd_admin_all"
  ON payout_distributions FOR ALL
  USING (is_admin());

-- =============================================================
-- forfeited_bonuses  (정지/제명 노드로 인한 낙전 수당)
-- =============================================================
CREATE TABLE IF NOT EXISTS forfeited_bonuses (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   uuid        REFERENCES profit_reports(id) ON DELETE CASCADE,  -- nullable: 수동 낙전은 report_id 없음
  profile_id  uuid        NOT NULL REFERENCES profiles(id),
  amount      numeric     NOT NULL DEFAULT 0,
  reason      text        NOT NULL CHECK (reason IN ('suspended','expelled','manual','company')),  -- company: 적격 직급자 없는 tier 풀의 회사 귀속분
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fb_report ON forfeited_bonuses(report_id);

ALTER TABLE forfeited_bonuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fb_admin_all"
  ON forfeited_bonuses FOR ALL
  USING (is_admin());

-- =============================================================
-- Function: validate_referral_code
-- Returns sponsor info + whether left/right legs are already taken.
-- SECURITY DEFINER so unauthenticated callers (during sign-up) can
-- look up any profile by referral code.
-- =============================================================
CREATE OR REPLACE FUNCTION validate_referral_code(code text)
RETURNS TABLE (
  profile_id    uuid,
  node_id       text,
  name          text,
  rank          text,
  left_taken    boolean,
  right_taken   boolean
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p.id                                                                              AS profile_id,
    p.node_id,
    p.name,
    p.rank,
    EXISTS(
      SELECT 1 FROM profiles c
      WHERE c.parent_id = p.id AND c.leg_position = 'LEFT'
    )                                                                                 AS left_taken,
    EXISTS(
      SELECT 1 FROM profiles c
      WHERE c.parent_id = p.id AND c.leg_position = 'RIGHT'
    )                                                                                 AS right_taken
  FROM profiles p
  WHERE p.referral_code = upper(trim(code));
$$;

-- =============================================================
-- popups — 홈페이지 팝업 공지 (관리자에서 등록, 기간 설정)
-- =============================================================
CREATE TABLE IF NOT EXISTS popups (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,
  body        text        NOT NULL DEFAULT '',
  link_url    text,                                   -- 선택: 버튼 링크
  link_label  text,                                   -- 선택: 버튼 문구
  start_at    timestamptz NOT NULL DEFAULT now(),     -- 노출 시작
  end_at      timestamptz,                            -- 노출 종료 (null = 무기한)
  active      boolean     NOT NULL DEFAULT true,      -- 수동 on/off
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================================
-- terms — 약관/정책 문서 (관리자에서 카테고리별 등록·수정)
-- =============================================================
CREATE TABLE IF NOT EXISTS terms (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,                  -- 카테고리/문서 제목 (예: 이용약관)
  body        text        NOT NULL DEFAULT '',       -- 본문 (일반 텍스트)
  sort_order  int         NOT NULL DEFAULT 0,        -- 노출 순서 (작을수록 위)
  published   boolean     NOT NULL DEFAULT true,     -- 게시 여부
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- popups / terms 는 모든 접근이 service-role API(/api/[admin/]popups·terms) 경유.
-- RLS 활성 + 정책 없음 → anon/authenticated 직접 접근 전면 차단 (service-role 만 우회).
ALTER TABLE popups ENABLE ROW LEVEL SECURITY;
ALTER TABLE terms  ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- Migration: run these in Supabase SQL editor if DB already exists
-- =============================================================
-- 6. ct_id 완전 제거 (node_id로 일원화). 순서 중요: 함수/트리거 먼저, 그 다음 컬럼 DROP
--    (a) get_downline 함수에서 ct_id 제거 — 위 CREATE OR REPLACE get_downline 블록 실행
--    (b) handle_new_profile 트리거에서 ct_id 제거 — 위 CREATE OR REPLACE handle_new_profile 블록 실행
--    (c) 컬럼/시퀀스 제거:
-- ALTER TABLE profiles DROP COLUMN IF EXISTS ct_id;
-- DROP SEQUENCE IF EXISTS ct_seq;

-- 8. get_downline 에 referral_code 추가 (회원 트리뷰 레퍼럴 코드 표시):
--    위 "DROP FUNCTION get_downline; CREATE FUNCTION ..." 블록을 referral_code 포함 버전으로 재실행
--    (RETURNS TABLE 와 양쪽 SELECT 에 referral_code 포함된 현재 schema.sql 의 get_downline 정의 사용)

-- 7. popups/terms RLS 활성화 (기존 DB 필수 — 미적용 시 anon 키로 직접 변조 가능):
-- ALTER TABLE popups ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE terms  ENABLE ROW LEVEL SECURITY;

-- 5. terms 테이블 신규 생성 (기존 DB라면 위 CREATE TABLE 블록 실행)
-- 4. popups 테이블 신규 생성 (기존 DB라면 위 CREATE TABLE 블록 실행)
-- 0. profit_reports.profile_id를 nullable로 변경 (미매칭 보고서 허용)
-- ALTER TABLE profit_reports ALTER COLUMN profile_id DROP NOT NULL;

-- 1. forfeited_bonuses.reason에 'manual' 허용 추가
-- ALTER TABLE forfeited_bonuses
--   DROP CONSTRAINT IF EXISTS forfeited_bonuses_reason_check;
-- ALTER TABLE forfeited_bonuses
--   ADD CONSTRAINT forfeited_bonuses_reason_check
--   CHECK (reason IN ('suspended','expelled','manual'));

-- 2. forfeited_bonuses.report_id를 nullable로 변경 (수동 낙전은 report 없음)
-- ALTER TABLE forfeited_bonuses ALTER COLUMN report_id DROP NOT NULL;

-- 3. profiles.id: add-node (가상 노드) 지원을 위해 FK 해제 + DEFAULT uuid 추가
--    - register 흐름: id = auth.users.id (명시 제공)
--    - add-node 흐름: id = gen_random_uuid() (auto-generated, auth 계정 없음)
-- ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
-- ALTER TABLE profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
