'use client'
import { useEffect } from 'react'
import Link from 'next/link'

/**
 * 랜딩(홈) 페이지 — 회사소개/홍보 + 로그인 유도.
 * 히어로 우측에 3D 네트워크 애니메이션(플로우 스플라인 · 떠다니는 노드 · 코어 고리 pulse).
 * 콘텐츠는 아직 확정 전이라 [placeholder] 골격만.
 */
export default function LandingPage() {
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery')) window.location.replace('/reset-password' + hash)
    else if (hash.includes('type=signup') || hash.includes('type=email')) window.location.replace('/auth/confirm' + hash)
  }, [])

  return (
    <div className="lp">
      <style>{CSS}</style>

      {/* ── 상단 네비 ── */}
      <header className="lp-nav">
        <div className="lp-brand"><Logo /><span>RCT Platform</span></div>
        <nav className="lp-navlinks">
          <a href="#about">소개</a>
          <a href="#features">특징</a>
          <a href="#how">이용방법</a>
          <Link href="/login" className="lp-login-btn">로그인</Link>
        </nav>
      </header>

      {/* ── 히어로 (좌: 텍스트 / 우: 3D 네트워크 씬) ── */}
      <section className="lp-hero">
        <div className="lp-hero-glow" />
        <div className="lp-hero-grid">
          {/* 좌 텍스트 */}
          <div className="lp-hero-text">
            <span className="lp-badge">System Active_</span>
            <h1 className="lp-h1">{/* [placeholder] 슬로건 */}자동 거래로 완성하는<br />새로운 수익의 기준</h1>
            <p className="lp-subhead">{/* [placeholder] */}여기에 회사를 한 문장으로 설명하는 카피가 들어갑니다. 링크 하나로 소개와 시작까지.</p>
            <div className="lp-cta-group">
              <Link href="/login" className="lp-metal-btn" aria-label="시작하기">
                <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Link>
              <span className="lp-cta-text">플랫폼 시작하기</span>
            </div>
          </div>

          {/* 우 3D 네트워크 씬 */}
          <div className="lp-canvas">
            <div className="lp-backdrop" />
            <div className="lp-scene">
              <svg className="lp-splines" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice">
                {SPLINES.map((d, i) => (
                  <g key={i}>
                    <path className="lp-spline-glow" d={d} />
                    <path className="lp-spline-path" d={d} />
                  </g>
                ))}
              </svg>
              {['NETWORK_01', 'NETWORK_02', 'NETWORK_03', 'NETWORK_04'].map((lbl, i) => (
                <div key={i} className={`lp-node lp-node-${i + 1}`}>
                  <div className="lp-card-head">
                    <div className="lp-avatar" />
                    <div style={{ flex: 1 }}>
                      <div className="lp-card-title" />
                      <div className="lp-card-meta" />
                    </div>
                  </div>
                  <div className="lp-play" />
                  <div className="lp-meta-lbl lp-lbl-1">{lbl}</div>
                </div>
              ))}
              <div className="lp-insight">
                <div className="lp-meta-lbl lp-lbl-2">CORE_NODE</div>
                <div className="lp-core"><Logo size={30} /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 소개 ── */}
      <section id="about" className="lp-section">
        <span className="lp-kicker">ABOUT</span>
        <h2 className="lp-h2">RCT Platform이란?</h2>
        <p className="lp-lead">여기에 회사 소개가 들어갑니다. 어떤 문제를 해결하는지, 왜 신뢰할 수 있는지, 어떤 가치를 주는지 간결하게 설명하는 자리입니다. 콘티가 확정되면 이 문단을 교체하세요.</p>
      </section>

      {/* ── 특징 ── */}
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

      {/* ── 이용방법 ── */}
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

      {/* ── CTA ── */}
      <section className="lp-cta">
        <h2>지금 시작해보세요</h2>
        <p>가입 후 바로 이용할 수 있습니다.</p>
        <Link href="/login" className="lp-btn-primary lg">로그인 / 시작하기 →</Link>
      </section>

      {/* ── 푸터 ── */}
      <footer className="lp-footer">
        <div className="lp-brand small"><Logo /><span>RCT Platform</span></div>
        <div className="lp-foot-meta">
          <span>© {new Date().getFullYear()} RCT Platform. All rights reserved.</span>
          <span>회사 정보 · 연락처가 들어갈 자리</span>
        </div>
      </footer>
    </div>
  )
}

function Logo({ size = 22 }: { size?: number }) {
  // 코어(밝은 금속) 위에서는 어둡게, 그 외엔 틸
  const dark = size >= 30
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={dark ? '#111' : '#4db6ac'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      style={dark ? { filter: 'drop-shadow(0 1px 0 rgba(255,255,255,0.5))' } : undefined} aria-hidden>
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  )
}

const SPLINES = [
  'M160 120 C 300 120, 200 300, 300 300',
  'M130 420 C 250 420, 200 300, 300 300',
  'M410 150 C 350 150, 400 300, 300 300',
  'M440 480 C 350 480, 400 300, 300 300',
]

const CSS = `
.lp { background:#07080a; color:#e0e6ed; font-family:var(--font-main); min-height:100vh;
  background-image:
    radial-gradient(circle at 0% 0%, #171a21 0%, transparent 45%),
    radial-gradient(circle at 100% 30%, #12151b 0%, transparent 50%); }
.lp a { text-decoration:none; color:inherit; }

/* 네비 */
.lp-nav { position:sticky; top:0; z-index:50; display:flex; align-items:center; justify-content:space-between;
  padding:16px 32px; background:rgba(7,8,10,0.7); backdrop-filter:blur(10px); border-bottom:1px solid rgba(148,163,184,0.08); }
.lp-brand { display:flex; align-items:center; gap:9px; font-weight:700; font-size:15px; letter-spacing:0.02em; }
.lp-brand.small { font-size:13px; opacity:0.8; }
.lp-navlinks { display:flex; align-items:center; gap:26px; font-size:14px; color:#94a3b8; }
.lp-navlinks a:hover { color:#e0e6ed; }
.lp-login-btn { border:1px solid #4db6ac; color:#4db6ac !important; padding:8px 20px; border-radius:999px;
  font-weight:600; background:rgba(77,182,172,0.05); transition:all .2s; }
.lp-login-btn:hover { background:#4db6ac; color:#07080a !important; box-shadow:0 0 16px rgba(77,182,172,0.3); }

/* 히어로 */
.lp-hero { position:relative; overflow:hidden; padding:80px 40px 90px; }
.lp-hero-glow { position:absolute; top:-10%; left:15%; width:700px; height:520px;
  background:radial-gradient(circle, rgba(77,182,172,0.08) 0%, transparent 65%); filter:blur(50px); pointer-events:none; }
.lp-hero-grid { position:relative; max-width:1400px; margin:0 auto; display:grid;
  grid-template-columns:1fr 1.2fr; gap:60px; align-items:center; min-height:520px; }
.lp-hero-text { display:flex; flex-direction:column; justify-content:center; z-index:10; }
.lp-badge { display:inline-flex; align-items:center; padding:6px 12px; background:rgba(255,255,255,0.02);
  border:1px solid rgba(255,255,255,0.06); border-radius:999px; font-size:12px; color:#9ea3aa;
  margin-bottom:22px; width:fit-content; letter-spacing:0.04em; text-transform:uppercase; font-family:var(--font-mono); }
.lp-h1 { font-size:64px; line-height:1.08; font-weight:300; letter-spacing:-0.03em; margin-bottom:22px;
  background:linear-gradient(180deg,#ffffff 0%, rgba(255,255,255,0.5) 100%); -webkit-background-clip:text;
  -webkit-text-fill-color:transparent; background-clip:text; }
.lp-subhead { font-size:19px; line-height:1.6; color:#9ea3aa; font-weight:300; max-width:480px; margin-bottom:44px; letter-spacing:-0.01em; }
.lp-cta-group { display:flex; align-items:center; gap:20px; }
.lp-cta-text { font-size:15px; font-weight:500; color:#f4f5f6; }

/* 금속 원형 버튼 */
.lp-metal-btn { display:flex; align-items:center; justify-content:center; width:64px; height:64px; border-radius:50%;
  background:radial-gradient(circle at 30% 30%, #f0f0f0 0%, #d1d3d6 50%, #a3a5a8 100%); border:none; cursor:pointer; position:relative;
  box-shadow:-4px -4px 12px rgba(255,255,255,0.05), 8px 8px 24px rgba(0,0,0,0.4), inset -2px -2px 6px rgba(0,0,0,0.15), inset 2px 2px 6px rgba(255,255,255,0.9);
  transition:transform .2s cubic-bezier(0.34,1.56,0.64,1), box-shadow .2s ease; }
.lp-metal-btn svg { width:24px; height:24px; stroke:#111; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; fill:none;
  filter:drop-shadow(0 1px 0 rgba(255,255,255,0.4)); }
.lp-metal-btn:hover { transform:scale(1.05); box-shadow:-4px -4px 12px rgba(255,255,255,0.08), 12px 12px 32px rgba(0,0,0,0.5), inset -2px -2px 6px rgba(0,0,0,0.15), inset 2px 2px 6px rgba(255,255,255,0.9); }
.lp-metal-btn:active { transform:scale(0.95); }

/* 3D 네트워크 씬 */
.lp-canvas { position:relative; display:flex; align-items:center; justify-content:center; perspective:1200px; min-height:520px; }
.lp-backdrop { position:absolute; inset:40px -20px -20px 20px; border-radius:48px;
  background:linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%);
  border-top:1px solid rgba(255,255,255,0.06); border-left:1px solid rgba(255,255,255,0.06);
  backdrop-filter:blur(40px); box-shadow:-20px -20px 60px rgba(255,255,255,0.02), 40px 40px 80px rgba(0,0,0,0.4);
  transform:rotateY(-15deg) rotateX(5deg) translateZ(-100px); transform-style:preserve-3d; pointer-events:none; }
.lp-scene { position:relative; width:100%; height:520px; transform-style:preserve-3d; transform:rotateY(-15deg) rotateX(5deg); }
.lp-splines { position:absolute; inset:0; width:100%; height:100%; z-index:1; }
.lp-spline-path { fill:none; stroke:rgba(255,255,255,0.15); stroke-width:1.5; stroke-dasharray:6 6; animation:lp-flow 20s linear infinite; }
.lp-spline-glow { fill:none; stroke:rgba(255,255,255,0.05); stroke-width:8; filter:blur(4px); }
@keyframes lp-flow { to { stroke-dashoffset:-100; } }

.lp-node { position:absolute; width:200px; height:120px; padding:12px; z-index:2;
  background:rgba(255,255,255,0.03); backdrop-filter:blur(16px) saturate(150%);
  border:1px solid rgba(255,255,255,0.08); border-top:1px solid rgba(255,255,255,0.15); border-radius:20px;
  box-shadow:0 24px 48px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1);
  display:flex; flex-direction:column; justify-content:space-between; transition:border-color .4s ease; }
.lp-node:hover { border-color:rgba(77,182,172,0.5); }
.lp-card-head { display:flex; align-items:center; gap:8px; }
.lp-avatar { width:20px; height:20px; border-radius:50%; background:rgba(255,255,255,0.1); }
.lp-card-title { height:4px; width:60%; background:rgba(255,255,255,0.2); border-radius:2px; }
.lp-card-meta { height:4px; width:40%; background:rgba(255,255,255,0.1); border-radius:2px; margin-top:6px; }
.lp-play { align-self:flex-end; width:24px; height:24px; border-radius:50%; background:rgba(255,255,255,0.1);
  display:flex; align-items:center; justify-content:center; }
.lp-play::after { content:''; width:0; height:0; border-style:solid; border-width:4px 0 4px 6px;
  border-color:transparent transparent transparent #fff; margin-left:2px; }

.lp-node-1 { top:10%; left:6%; --tz:30px; animation:lp-float 6s ease-in-out infinite; }
.lp-node-2 { top:60%; left:2%; --tz:10px; animation:lp-float 8s ease-in-out infinite 1s; }
.lp-node-3 { top:12%; right:8%; --tz:40px; animation:lp-float 7s ease-in-out infinite 2s; }
.lp-node-4 { top:66%; right:4%; --tz:20px; animation:lp-float 9s ease-in-out infinite .5s; }
@keyframes lp-float { 0%,100% { transform:translateY(0) translateZ(var(--tz,20px)); } 50% { transform:translateY(-12px) translateZ(var(--tz,20px)); } }

.lp-insight { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) translateZ(80px);
  width:140px; height:140px; border-radius:50%; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1);
  box-shadow:0 32px 64px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.1);
  display:flex; align-items:center; justify-content:center; z-index:10; }
.lp-core { width:80px; height:80px; border-radius:50%; position:relative; display:flex; align-items:center; justify-content:center;
  background:radial-gradient(circle at 30% 30%, #f0f0f0 0%, #d1d3d6 60%, #a3a5a8 100%);
  box-shadow:-4px -4px 12px rgba(255,255,255,0.05), 8px 8px 24px rgba(0,0,0,0.3), inset -2px -2px 6px rgba(0,0,0,0.2), inset 2px 2px 6px rgba(255,255,255,0.9); }
/* 고리 생성 애니메이션 */
.lp-core::before { content:''; position:absolute; inset:-12px; border-radius:50%; border:1px solid rgba(77,182,172,0.35);
  animation:lp-pulse 4s cubic-bezier(0.4,0,0.6,1) infinite; }
.lp-core::after { content:''; position:absolute; inset:-12px; border-radius:50%; border:1px solid rgba(77,182,172,0.25);
  animation:lp-pulse 4s cubic-bezier(0.4,0,0.6,1) infinite 2s; }
@keyframes lp-pulse { 0% { transform:scale(1); opacity:1; } 100% { transform:scale(1.6); opacity:0; } }

.lp-meta-lbl { position:absolute; font-size:10px; font-family:var(--font-mono); color:rgba(255,255,255,0.4); letter-spacing:0.1em; pointer-events:none; }
.lp-lbl-1 { bottom:-22px; left:50%; transform:translateX(-50%); }
.lp-lbl-2 { top:-26px; left:50%; transform:translateX(-50%); }

/* 섹션 공통 */
.lp-section { max-width:1080px; margin:0 auto; padding:90px 32px; }
.lp-kicker { font-family:var(--font-mono); font-size:11px; letter-spacing:0.28em; color:#4db6ac; }
.lp-h2 { font-size:32px; font-weight:800; margin:10px 0 22px; }
.lp-lead { font-size:16px; color:#94a3b8; line-height:1.8; max-width:720px; }

.lp-cards { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; margin-top:26px; }
.lp-card { background:#11141b; border:1px solid rgba(148,163,184,0.1); border-radius:14px; padding:28px; transition:all .2s; }
.lp-card:hover { border-color:rgba(77,182,172,0.4); transform:translateY(-3px); }
.lp-card-icon { font-size:26px; margin-bottom:14px; }
.lp-card h3 { font-size:18px; font-weight:700; margin-bottom:8px; }
.lp-card p { font-size:14px; color:#94a3b8; line-height:1.7; }

.lp-steps { display:grid; grid-template-columns:repeat(4,1fr); gap:18px; margin-top:26px; }
.lp-step { border-left:2px solid rgba(77,182,172,0.3); padding:6px 0 6px 18px; }
.lp-step-n { font-family:var(--font-mono); font-size:22px; font-weight:700; color:#4db6ac; }
.lp-step h4 { font-size:16px; font-weight:700; margin:8px 0 6px; }
.lp-step p { font-size:13px; color:#94a3b8; line-height:1.6; }

.lp-cta { text-align:center; padding:90px 32px; margin:20px auto; max-width:1080px;
  background:linear-gradient(180deg, rgba(77,182,172,0.07), transparent);
  border-top:1px solid rgba(148,163,184,0.08); border-bottom:1px solid rgba(148,163,184,0.08); }
.lp-cta h2 { font-size:30px; font-weight:800; }
.lp-cta p { color:#94a3b8; margin:12px 0 26px; }
.lp-btn-primary { display:inline-block; background:#4db6ac; color:#07080a; font-weight:700; padding:13px 30px; border-radius:8px; transition:all .2s; }
.lp-btn-primary:hover { box-shadow:0 8px 24px rgba(77,182,172,0.3); transform:translateY(-2px); }
.lp-btn-primary.lg { padding:15px 40px; font-size:15px; }

.lp-footer { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:14px;
  max-width:1080px; margin:0 auto; padding:30px 32px 50px; border-top:1px solid rgba(148,163,184,0.08); }
.lp-foot-meta { display:flex; flex-direction:column; gap:4px; font-size:12px; color:#64748b; text-align:right; }

/* 반응형 */
@media (max-width:1024px) {
  .lp-hero-grid { grid-template-columns:1fr; gap:40px; }
  .lp-canvas { perspective:none; min-height:440px; order:-1; }
  .lp-scene { transform:none; height:440px; }
  .lp-backdrop { transform:none; inset:20px 0 0 0; }
  .lp-node { --tz:0px !important; }
  .lp-insight { transform:translate(-50%,-50%); }
}
@media (max-width:768px) {
  .lp-nav { padding:12px 18px; } .lp-navlinks { gap:14px; font-size:13px; }
  .lp-navlinks a:not(.lp-login-btn) { display:none; }
  .lp-hero { padding:50px 20px 70px; }
  .lp-h1 { font-size:40px; } .lp-subhead { font-size:16px; }
  .lp-node { width:160px; height:100px; }
  .lp-section { padding:60px 20px; } .lp-h2 { font-size:26px; }
  .lp-cards, .lp-steps { grid-template-columns:1fr; }
  .lp-footer { flex-direction:column; align-items:flex-start; } .lp-foot-meta { text-align:left; }
}
`
