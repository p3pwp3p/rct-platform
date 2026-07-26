'use client'
import { useEffect } from 'react'
import Link from 'next/link'

/**
 * 랜딩(홈) 페이지 — 회사소개/홍보 + 로그인 유도.
 * 콘텐츠는 아직 확정 전이라 [placeholder] 로 골격만 잡음. 문구/이미지는 나중에 교체.
 */
export default function LandingPage() {
  // 비밀번호 재설정/가입 인증 링크가 루트로 떨어질 때 토큰 보존 후 전달 (기존 로직 유지)
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery')) {
      window.location.replace('/reset-password' + hash)
    } else if (hash.includes('type=signup') || hash.includes('type=email')) {
      window.location.replace('/auth/confirm' + hash)
    }
  }, [])

  return (
    <div className="lp">
      <style>{CSS}</style>

      {/* ── 상단 네비 ── */}
      <header className="lp-nav">
        <div className="lp-brand">
          <Logo />
          <span>RCT Platform</span>
        </div>
        <nav className="lp-navlinks">
          <a href="#about">소개</a>
          <a href="#features">특징</a>
          <a href="#how">이용방법</a>
          <Link href="/login" className="lp-login-btn">로그인</Link>
        </nav>
      </header>

      {/* ── 히어로 ── */}
      <section className="lp-hero">
        <div className="lp-hero-glow" />
        <div className="lp-hero-inner">
          <span className="lp-eyebrow">AUTOMATED COPY TRADING</span>
          <h1 className="lp-title">
            {/* [placeholder] 핵심 슬로건 */}
            자동 거래로 완성하는<br />새로운 수익의 기준
          </h1>
          <p className="lp-sub">
            {/* [placeholder] 한 줄 설명 */}
            여기에 회사를 한 문장으로 설명하는 카피가 들어갑니다. 링크 하나로 소개와 시작까지.
          </p>
          <div className="lp-hero-cta">
            <Link href="/login" className="lp-btn-primary">시작하기 →</Link>
            <a href="#about" className="lp-btn-ghost">자세히 보기</a>
          </div>
        </div>
      </section>

      {/* ── 소개 ── */}
      <section id="about" className="lp-section">
        <span className="lp-kicker">ABOUT</span>
        <h2 className="lp-h2">RCT Platform이란?</h2>
        <p className="lp-lead">
          {/* [placeholder] 회사/서비스 소개 2~3문장 */}
          여기에 회사 소개가 들어갑니다. 어떤 문제를 해결하는지, 왜 신뢰할 수 있는지, 어떤 가치를 주는지
          간결하게 설명하는 자리입니다. 콘티가 확정되면 이 문단을 교체하세요.
        </p>
      </section>

      {/* ── 특징 (3 카드) ── */}
      <section id="features" className="lp-section">
        <span className="lp-kicker">FEATURES</span>
        <h2 className="lp-h2">핵심 특징</h2>
        <div className="lp-cards">
          {[
            { i: '⚡', t: '자동 거래', d: '[placeholder] 자동 거래 시스템에 대한 설명이 들어갑니다.' },
            { i: '📊', t: '투명한 정산', d: '[placeholder] 월간 수익 정산과 투명성에 대한 설명.' },
            { i: '🤝', t: '보상 플랜', d: '[placeholder] 추천/직급 보상 플랜에 대한 설명.' },
          ].map((c, i) => (
            <div key={i} className="lp-card">
              <div className="lp-card-icon">{c.i}</div>
              <h3>{c.t}</h3>
              <p>{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 이용방법 (스텝) ── */}
      <section id="how" className="lp-section">
        <span className="lp-kicker">HOW IT WORKS</span>
        <h2 className="lp-h2">이용 방법</h2>
        <div className="lp-steps">
          {[
            { n: '01', t: '계좌 개설', d: '[placeholder] 첫 단계 설명' },
            { n: '02', t: '자동 거래 연결', d: '[placeholder] 두 번째 단계 설명' },
            { n: '03', t: '수익 정산', d: '[placeholder] 세 번째 단계 설명' },
            { n: '04', t: '보상 수령', d: '[placeholder] 네 번째 단계 설명' },
          ].map((s, i) => (
            <div key={i} className="lp-step">
              <span className="lp-step-n">{s.n}</span>
              <h4>{s.t}</h4>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA 밴드 ── */}
      <section className="lp-cta">
        <h2>{/* [placeholder] */}지금 시작해보세요</h2>
        <p>{/* [placeholder] */}가입 후 바로 이용할 수 있습니다.</p>
        <Link href="/login" className="lp-btn-primary lg">로그인 / 시작하기 →</Link>
      </section>

      {/* ── 푸터 ── */}
      <footer className="lp-footer">
        <div className="lp-brand small"><Logo /> <span>RCT Platform</span></div>
        <div className="lp-foot-meta">
          {/* [placeholder] 회사명 · 사업자정보 · 연락처 */}
          <span>© {new Date().getFullYear()} RCT Platform. All rights reserved.</span>
          <span>회사 정보 · 연락처가 들어갈 자리</span>
        </div>
      </footer>
    </div>
  )
}

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4db6ac" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  )
}

const CSS = `
.lp { background:#07080a; color:#e0e6ed; font-family:var(--font-main); min-height:100vh; }
.lp a { text-decoration:none; color:inherit; }

/* 네비 */
.lp-nav { position:sticky; top:0; z-index:50; display:flex; align-items:center; justify-content:space-between;
  padding:16px 32px; background:rgba(7,8,10,0.7); backdrop-filter:blur(10px); border-bottom:1px solid rgba(148,163,184,0.08); }
.lp-brand { display:flex; align-items:center; gap:9px; font-weight:700; font-size:15px; letter-spacing:0.02em; }
.lp-brand.small { font-size:13px; opacity:0.8; }
.lp-navlinks { display:flex; align-items:center; gap:26px; font-size:14px; color:#94a3b8; }
.lp-navlinks a:hover { color:#e0e6ed; }
.lp-login-btn { border:1px solid #4db6ac; color:#4db6ac !important; padding:8px 20px; border-radius:6px;
  font-weight:600; transition:all .2s; }
.lp-login-btn:hover { background:#4db6ac; color:#07080a !important; }

/* 히어로 */
.lp-hero { position:relative; overflow:hidden; padding:120px 32px 130px; text-align:center; }
.lp-hero-glow { position:absolute; top:-20%; left:50%; transform:translateX(-50%); width:900px; height:600px;
  background:radial-gradient(circle, rgba(77,182,172,0.10) 0%, transparent 65%); filter:blur(40px); pointer-events:none; }
.lp-hero-inner { position:relative; max-width:820px; margin:0 auto; display:flex; flex-direction:column; align-items:center; gap:22px; }
.lp-eyebrow { font-family:var(--font-mono); font-size:12px; letter-spacing:0.32em; color:#4db6ac; }
.lp-title { font-size:52px; font-weight:800; line-height:1.2; letter-spacing:-0.01em; }
.lp-sub { font-size:17px; color:#94a3b8; line-height:1.7; max-width:560px; }
.lp-hero-cta { display:flex; gap:14px; margin-top:10px; flex-wrap:wrap; justify-content:center; }

.lp-btn-primary { background:#4db6ac; color:#07080a; font-weight:700; padding:13px 30px; border-radius:8px;
  transition:all .2s; }
.lp-btn-primary:hover { box-shadow:0 8px 24px rgba(77,182,172,0.3); transform:translateY(-2px); }
.lp-btn-primary.lg { padding:15px 40px; font-size:15px; }
.lp-btn-ghost { border:1px solid rgba(148,163,184,0.25); color:#e0e6ed; padding:13px 26px; border-radius:8px; transition:all .2s; }
.lp-btn-ghost:hover { border-color:#4db6ac; color:#4db6ac; }

/* 섹션 공통 */
.lp-section { max-width:1080px; margin:0 auto; padding:90px 32px; }
.lp-kicker { font-family:var(--font-mono); font-size:11px; letter-spacing:0.28em; color:#4db6ac; }
.lp-h2 { font-size:32px; font-weight:800; margin:10px 0 22px; }
.lp-lead { font-size:16px; color:#94a3b8; line-height:1.8; max-width:720px; }

/* 특징 카드 */
.lp-cards { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; margin-top:26px; }
.lp-card { background:#11141b; border:1px solid rgba(148,163,184,0.1); border-radius:14px; padding:28px; transition:all .2s; }
.lp-card:hover { border-color:rgba(77,182,172,0.4); transform:translateY(-3px); }
.lp-card-icon { font-size:26px; margin-bottom:14px; }
.lp-card h3 { font-size:18px; font-weight:700; margin-bottom:8px; }
.lp-card p { font-size:14px; color:#94a3b8; line-height:1.7; }

/* 스텝 */
.lp-steps { display:grid; grid-template-columns:repeat(4,1fr); gap:18px; margin-top:26px; }
.lp-step { border-left:2px solid rgba(77,182,172,0.3); padding:6px 0 6px 18px; }
.lp-step-n { font-family:var(--font-mono); font-size:22px; font-weight:700; color:#4db6ac; }
.lp-step h4 { font-size:16px; font-weight:700; margin:8px 0 6px; }
.lp-step p { font-size:13px; color:#94a3b8; line-height:1.6; }

/* CTA 밴드 */
.lp-cta { text-align:center; padding:90px 32px; margin:20px auto; max-width:1080px;
  background:linear-gradient(180deg, rgba(77,182,172,0.07), transparent); border-top:1px solid rgba(148,163,184,0.08);
  border-bottom:1px solid rgba(148,163,184,0.08); }
.lp-cta h2 { font-size:30px; font-weight:800; }
.lp-cta p { color:#94a3b8; margin:12px 0 26px; }

/* 푸터 */
.lp-footer { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:14px;
  max-width:1080px; margin:0 auto; padding:30px 32px 50px; border-top:1px solid rgba(148,163,184,0.08); }
.lp-foot-meta { display:flex; flex-direction:column; gap:4px; font-size:12px; color:#64748b; text-align:right; }

/* 반응형 */
@media (max-width:768px) {
  .lp-nav { padding:12px 18px; }
  .lp-navlinks { gap:14px; font-size:13px; }
  .lp-navlinks a:not(.lp-login-btn) { display:none; }
  .lp-hero { padding:80px 20px 90px; }
  .lp-title { font-size:34px; }
  .lp-sub { font-size:15px; }
  .lp-section { padding:60px 20px; }
  .lp-h2 { font-size:26px; }
  .lp-cards, .lp-steps { grid-template-columns:1fr; }
  .lp-footer { flex-direction:column; align-items:flex-start; }
  .lp-foot-meta { text-align:left; }
}
`
