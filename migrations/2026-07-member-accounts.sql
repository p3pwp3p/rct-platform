-- ============================================================================
-- member_accounts — 계정(=auth 유저) 단위 Vantage 정보
--
-- 정책 변경: Vantage C.T 는 이제 "노드별"이 아니라 "회원 계정당 1개".
--  - vantage_ct: 회원의 단일 Vantage 카피계정 번호
--  - fee_balance: 크롤러가 주기적으로 갱신하는 수수료 잔고
--  - allowed_nodes: floor(fee_balance / 3000). 예외회원은 무제한(통제 면제)
--  - is_exempt: 대표이사 등 통제 면제 (조용문·이형배·박지혁)
--
-- 노드 통제: 현재 active 노드수 > allowed_nodes 이면 초과분을 status='suspended'
--            로 정지(비파괴). 정산엔진이 active 아닌 노드 수당을 자동 몰수한다.
-- ============================================================================

create table if not exists public.member_accounts (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  vantage_ct       text unique,
  fee_balance      numeric,
  allowed_nodes    int,
  is_exempt        boolean not null default false,
  balance_synced_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.member_accounts enable row level security;

-- 본인 계정 조회(잔고·허용노드 표시용) 또는 관리자
drop policy if exists member_accounts_select on public.member_accounts;
create policy member_accounts_select on public.member_accounts
  for select using (user_id = auth.uid() or public.is_admin());

-- 수정은 관리자만 (잔고/허용노드/면제). 크롤러 임포트는 service-role 로 RLS 우회.
drop policy if exists member_accounts_update on public.member_accounts;
create policy member_accounts_update on public.member_accounts
  for update using (public.is_admin()) with check (public.is_admin());

-- ── 백필: 각 회원의 "메인 노드(가장 낮은 node_id 중 CT 있는 것)" CT 를 기본값으로 ──
insert into public.member_accounts (user_id, vantage_ct, is_exempt)
select distinct on (owner_id)
  owner_id,
  mt5_account_id,
  owner_id in (
    'b1128729-fd96-4e11-9b3e-ecf8d322bc27',  -- 조용문(대표이사)
    '6cb46862-f4b6-4d67-96b1-d6697bff3edb',  -- 이형배(RCT-00005)
    'dec29c21-0711-40a9-9240-0215730e6d11'   -- 박지혁
  ) as is_exempt
from public.profiles
where owner_id is not null
order by owner_id, (mt5_account_id is not null) desc, node_id asc
on conflict (user_id) do nothing;

-- 백필로 안 잡힌(노드는 없지만 계정은 있는) 예외회원도 면제 플래그 보장
insert into public.member_accounts (user_id, is_exempt)
values
  ('b1128729-fd96-4e11-9b3e-ecf8d322bc27', true),
  ('6cb46862-f4b6-4d67-96b1-d6697bff3edb', true),
  ('dec29c21-0711-40a9-9240-0215730e6d11', true)
on conflict (user_id) do update set is_exempt = true;
