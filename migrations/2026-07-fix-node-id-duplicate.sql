-- ============================================================================
-- 노드 추가 시 duplicate key "profiles_node_id_key" 오류 수정
--
-- [원인] node_id 는 트리거가 nextval('node_seq') 로 생성하는데,
--   과거에 node_id 를 직접 지정해 INSERT 한 노드들(RCT-00001, RCT-01000 등)이
--   시퀀스를 증가시키지 않아 node_seq 가 실제 최대 번호보다 뒤처짐.
--   → 새 노드 추가 시 nextval 이 이미 존재하는 번호를 반환해 충돌.
-- ============================================================================

-- ── STEP 1. node_seq 를 현재 최대 RCT 번호로 맞추기 (즉시 복구) ───────────────
--   setval(..., N, true) → 다음 nextval 은 N+1 을 반환.
SELECT setval(
  'node_seq',
  (SELECT COALESCE(MAX(substring(node_id from 'RCT-(\d+)')::int), 0) FROM profiles),
  true
);

-- ── STEP 2. 트리거 보강 — 시퀀스가 뒤처져도 자가 회복 (재발 방지) ─────────────
--   사용 중이 아닌 번호가 나올 때까지 nextval 반복.
CREATE OR REPLACE FUNCTION handle_new_profile()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code  text := '';
  i     int;
BEGIN
  IF NEW.node_id IS NULL OR NEW.node_id = '' THEN
    LOOP
      NEW.node_id := 'RCT-' || LPAD(nextval('node_seq')::text, 5, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE node_id = NEW.node_id);
    END LOOP;
  END IF;

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
