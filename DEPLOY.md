# 배포 체크리스트 (RCT Platform)

이 세션에서 추가된 기능(실시간·인앱알림·노드 통제·CSV 정산 등)을 프로덕션에 올릴 때 필요한 절차.

## 1. 환경변수

| 변수 | 필수 | 설명 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | anon 키(클라이언트, RLS 적용) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | service-role 키(서버 전용, RLS 우회) — **절대 클라이언트 노출 금지** |
| `INTERNAL_API_SECRET` | ✅ | 서버-서버 내부 호출 인증(rank-check, import-copiers). 랜덤 64hex 권장. **누락 시 노드 추가/삭제 후 자동 승급·크롤러 전송이 401** |
| `NEXT_PUBLIC_SENTRY_DSN` | 선택 | 있으면 에러 추적 활성화. 없으면 no-op |
| `SENTRY_AUTH_TOKEN` | 선택 | 소스맵 업로드용(빌드 시) |

> `INTERNAL_API_SECRET` 은 로컬 `.env.local` 과 배포 환경이 **같은 값**일 필요는 없지만, 크롤러(`scripts/vantage-sync/.env` 의 `RCT_INTERNAL_SECRET`)가 전송하는 대상 서버의 값과는 **일치해야** 함.

## 2. 마이그레이션 (Supabase SQL 에디터에서 순서대로)

`migrations/` 폴더. **순서 중요** — 뒤 항목이 `is_admin()` 등 앞의 정의에 의존.

1. `2026-06-fix-admin-role-app-metadata.sql` — 관리자 판정을 app_metadata 로(보안) + `is_admin()`
2. `2026-07-fix-node-id-duplicate.sql` — node_id 시퀀스/트리거
3. `2026-07-renumber-node-ids.sql` — (필요 시) 노드 번호 재정렬
4. `2026-07-rate-limit.sql` — 레이트리밋 RPC
5. `2026-07-admin-audit-log.sql` — 감사 로그 테이블
6. `2026-07-delete-node-cascade.sql` — 노드 삭제 RPC
7. `2026-07-enable-realtime.sql` — profiles/payout_distributions 실시간 퍼블리케이션
8. `2026-07-notifications.sql` — 인앱 알림 테이블 + RLS + 실시간
9. `2026-07-member-accounts.sql` — 계정별 Vantage/잔고/예외 + 백필
10. `2026-07-node-grace.sql` — profiles 유예 컬럼(pending_action/grace_until/pending_reason)

> 이미 개발 환경에서 실행한 것도 **프로덕션엔 다시 실행** 필요.

## 3. 배포 후 확인

- [ ] 로그인/대시보드 정상, 관리자 `/admin` 접근
- [ ] 벨 알림·홈 팝업 표시
- [ ] `/admin/node-control` 로딩(초기엔 전부 "미동기화")
- [ ] `/admin/payouts/import` CSV 미리보기 동작
- [ ] 빌드 게이트: `npm test` (32 통과) + `npm run build` 성공

## 4. 크롤러(노드 통제 데이터 동기화)

`scripts/vantage-sync/` — 관리자 PC에서 실행(서버 아님).
- [ ] `.env` 에 `RCT_API_URL`(배포 도메인), `RCT_INTERNAL_SECRET`(위 값), `APPLY`
- [ ] `start-chrome.ps1` 로 로그인된 Chrome 유지
- [ ] 첫 실행은 `APPLY=false`(시뮬레이션)로 대사표 확인 → 이상 없으면 `APPLY=true`
- [ ] 매시간 자동화(작업 스케줄러) — README 참고

## 5. 운영 데이터 정리(선택, 회원 안내 후)

- [ ] 다중 Vantage 계정 회원 통합(리챠드/김성겸/송정곤) → 살릴 CT 하나로
- [ ] 조용문 2번 계정(20174536) 처리
- [ ] 미등록 카피자(JUNYOUNG LEE 등) 확인
- [ ] (선택) HQ에 월간 CSV equity 컬럼 요청 → 크롤러 대체 가능

## 미완/보류

- PDF 크로스체크(기능 2-C): 월간 PDF+CSV 샘플 확보 후 구현
