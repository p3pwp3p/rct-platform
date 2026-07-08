-- ============================================================================
-- 레이트리밋 — Supabase 테이블 기반 (외부 서비스 불필요)
--
-- check_rate_limit(key, max, window_seconds):
--   단일 원자적 upsert 로 윈도우 내 카운트를 증가/리셋하고, 한도 이하이면 true.
--   경쟁 안전(ON CONFLICT). service-role(API)만 호출.
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_limits (
  key          text        PRIMARY KEY,
  count        int         NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;  -- 정책 없음 → service-role 만 접근

CREATE OR REPLACE FUNCTION check_rate_limit(p_key text, p_max int, p_window_seconds int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  INSERT INTO rate_limits(key, count, window_start)
  VALUES (p_key, 1, now())
  ON CONFLICT (key) DO UPDATE SET
    count = CASE
      WHEN rate_limits.window_start < now() - make_interval(secs => p_window_seconds) THEN 1
      ELSE rate_limits.count + 1
    END,
    window_start = CASE
      WHEN rate_limits.window_start < now() - make_interval(secs => p_window_seconds) THEN now()
      ELSE rate_limits.window_start
    END
  RETURNING count INTO v_count;

  RETURN v_count <= p_max;
END;
$$;

REVOKE EXECUTE ON FUNCTION check_rate_limit(text, int, int) FROM public, authenticated, anon;

-- (선택) 오래된 레코드 정리용 — 필요 시 크론/수동 실행
-- DELETE FROM rate_limits WHERE window_start < now() - interval '1 day';
