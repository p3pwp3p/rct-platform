-- ============================================================================
-- 노드 삭제(collapse) — 원자적 RPC
--
-- 규칙:
--  - 바이너리 자식(parent_id) 이 2개면 삭제 불가 (LEFT/RIGHT 한 자리에 둘을 못 올림)
--  - 바이너리 자식 1개 → 삭제 노드 자리로 승격 (부모/레그 승계)
--  - 추천 자식(referrer_id) 전부 → 삭제 노드의 추천인으로 승계 (N-ary, 제한 없음)
--  - 수당/낙전/정산 이력이 있는 노드는 삭제 불가 (회계 정합성)
--
-- 전 과정이 함수 본문(=단일 트랜잭션)에서 실행되므로, 어느 단계든 실패하면
-- 전체 롤백되어 부분 손상이 없다.
--
-- 권한: SECURITY DEFINER + public/authenticated 실행 취소 → service-role(API)만 호출.
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_node_cascade(target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n          profiles%ROWTYPE;
  bin_count  int;
  child_id   uuid;
BEGIN
  SELECT * INTO n FROM profiles WHERE id = target;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NODE_NOT_FOUND';
  END IF;

  -- 수당/낙전/정산 이력이 있으면 삭제 금지 (명확한 예외로 조기 차단)
  IF EXISTS (SELECT 1 FROM payout_distributions WHERE source_id = target OR recipient_id = target)
     OR EXISTS (SELECT 1 FROM forfeited_bonuses  WHERE profile_id = target)
     OR EXISTS (SELECT 1 FROM profit_report_items WHERE matched_profile_id = target) THEN
    RAISE EXCEPTION 'HAS_FINANCIAL_RECORDS';
  END IF;

  -- 바이너리 자식 수 확인
  SELECT count(*) INTO bin_count FROM profiles WHERE parent_id = target;
  IF bin_count > 1 THEN
    RAISE EXCEPTION 'BINARY_TWO_CHILDREN';
  END IF;

  -- 바이너리 자식 1개 → 삭제 노드 자리(부모/레그)로 승격
  IF bin_count = 1 THEN
    SELECT id INTO child_id FROM profiles WHERE parent_id = target;
    UPDATE profiles
      SET parent_id = n.parent_id, leg_position = n.leg_position
      WHERE id = child_id;
  END IF;

  -- 추천 자식 전부 → 삭제 노드의 추천인으로 승계
  UPDATE profiles SET referrer_id = n.referrer_id WHERE referrer_id = target;

  -- 노드 삭제 (rank_history/status_history 는 ON DELETE CASCADE 로 자동 정리,
  --           profit_reports.profile_id 는 SET NULL)
  DELETE FROM profiles WHERE id = target;
END;
$$;

REVOKE EXECUTE ON FUNCTION delete_node_cascade(uuid) FROM public, authenticated, anon;
