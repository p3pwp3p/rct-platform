# RCT Platform 이메일 템플릿

Supabase가 발송하는 인증 메일의 **본문(HTML)** 입니다.
Supabase 대시보드에 붙여넣어 RCT 브랜딩을 적용합니다. (방법 A — 코드 배포 불필요)

## 적용 위치

**Supabase Dashboard → Authentication → Email Templates**

| 파일 | 붙여넣을 템플릿 | 제목(Subject) 예시 |
|---|---|---|
| `reset-password.html` | **Reset Password** | `[RCT Platform] 비밀번호 재설정 안내` |
| `confirm-signup.html` | **Confirm signup** | `[RCT Platform] 이메일 인증을 완료해 주세요` |

각 템플릿 화면에서 **Message body (HTML)** 칸에 파일 내용을 통째로 붙여넣고,
**Subject** 칸에 위 제목을 입력한 뒤 저장합니다.

## 변수

- `{{ .ConfirmationURL }}` — Supabase가 자동 생성하는 인증/재설정 링크. 그대로 두세요.
- 가입 인증 링크는 회원가입 시 지정한 `emailRedirectTo`(`/auth/confirm`)로,
  비밀번호 재설정 링크는 `redirectTo`(`/reset-password`)로 연결됩니다.

## 함께 확인할 대시보드 설정

- **Authentication → URL Configuration → Redirect URLs** 에
  `https://<배포도메인>/auth/confirm`, `https://<배포도메인>/reset-password` 등록
- **Site URL** 을 실제 배포 도메인으로 설정

## 디자인 메모

- 이메일 클라이언트 호환을 위해 **테이블 레이아웃 + 인라인 스타일**, 웹 안전 폰트 사용.
- 다크 배경(#07080a) + 틸 강조(#4db6ac)로 앱과 톤 일치.
- 일부 구형 클라이언트(Outlook 등)에서 둥근 모서리가 사각으로 보일 수 있으나 기능엔 영향 없음.

## 다음 단계 (방법 B — 추후)

발송량·도달률·발신주소 통제가 필요해지면:
1. 도메인 확보 → Resend/SendGrid 가입 → DKIM/SPF 인증
2. Supabase에 커스텀 SMTP 연결
3. (선택) Auth "Send Email" Hook 으로 메일을 앱 코드에서 직접 렌더링
