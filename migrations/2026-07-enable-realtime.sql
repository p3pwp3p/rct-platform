-- 실시간 업데이트: 아래 테이블의 변경을 클라이언트가 구독할 수 있도록
-- supabase_realtime 퍼블리케이션에 추가한다.
-- RLS 는 그대로 적용되므로, 각 사용자는 SELECT 가능한 행의 변경만 수신한다.
--
-- 이미 퍼블리케이션에 포함돼 있으면 에러가 날 수 있으므로 개별 실행 권장.
-- (Supabase Dashboard > Database > Replication 에서도 토글 가능)

alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.payout_distributions;

-- 참고: UPDATE/DELETE 이벤트에서 이전 행(old record)까지 받으려면 REPLICA IDENTITY FULL 필요.
-- 본 앱은 변경 감지 후 API 재검증(mutate)만 하므로 old record 는 불필요.
