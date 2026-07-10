-- ④ 인앱 알림
-- 알림 테이블. user_id = 알림을 받는 auth 유저(노드 owner_id ?? profile.id).
-- 발송은 서버(service-role)에서만, 조회/읽음처리는 본인만.

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  profile_id  uuid references public.profiles(id) on delete set null,
  type        text not null,                -- 'payout' | 'rank_up' | 'system'
  title       text not null,
  body        text not null default '',
  metadata    jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

-- 본인 알림만 조회 (관리자는 is_admin() 으로 전체)
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select using (user_id = auth.uid() or public.is_admin());

-- 본인 알림만 수정 (읽음처리). service-role 은 RLS 우회.
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- INSERT/DELETE 정책 없음 → 오직 service-role(서버)만 발송/정리 가능.

-- 실시간 구독 대상에 추가 (RLS 로 본인 알림만 수신)
alter publication supabase_realtime add table public.notifications;
