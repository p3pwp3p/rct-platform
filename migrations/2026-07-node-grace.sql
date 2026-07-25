-- ============================================================================
-- 노드 정지 유예(grace) — 즉시 정지 대신 "예고 후 정지"
--
--  - pending_action: 예정된 조치 ('suspend' 등). null 이면 예정 없음.
--  - grace_until:    이 시각 이후 다음 동기화에서 실제 조치 적용.
--  - pending_reason: 사유(회원 안내용 메시지).
--
-- 흐름: 초과 감지 → pending_action='suspend', grace_until=now+7일 + 회원 알림/팝업
--       → 7일 뒤에도 초과면 status='suspended' 적용 / 그 전에 회복되면 pending 해제.
-- ============================================================================

alter table public.profiles add column if not exists pending_action  text;
alter table public.profiles add column if not exists grace_until      timestamptz;
alter table public.profiles add column if not exists pending_reason   text;

-- 회원이 본인 노드의 pending 상태를 조회할 수 있어야 모달/알림을 띄운다.
-- (profiles 는 이미 본인/소유 노드 select 정책이 있으므로 컬럼만 추가하면 노출됨)
