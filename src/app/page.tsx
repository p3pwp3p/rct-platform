'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import ButterflyCanvas from '@/components/ButterflyCanvas'

/**
 * 랜딩(홈) — 스크롤 2단 구성.
 *  1) 첫 화면: 노드 애니메이션(글래스 노드·스플라인·코어 고리 pulse)
 *  2) 스크롤: 나비 궤적 파티클 애니메이션(Butterfly 무드)
 * 브랜드(RCT 로고/틸). 콘텐츠는 [placeholder].
 *
 * 노출 스위치: 프로덕션(Vercel 미설정)에선 /login 으로. 로컬(.env.local=true)에서만 랜딩.
 */
const LANDING_ENABLED = process.env.NEXT_PUBLIC_LANDING_ENABLED === 'true'

export default function LandingPage() {
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery')) { window.location.replace('/reset-password' + hash); return }
    if (hash.includes('type=signup') || hash.includes('type=email')) { window.location.replace('/auth/confirm' + hash); return }
    if (!LANDING_ENABLED) window.location.replace('/login')
  }, [])

  if (!LANDING_ENABLED) return null

  return (
    <div className="lp">
      <style>{CSS}</style>

      {/* 상단 네비 (양 화면 공통) */}
      <header className="lp-nav">
        <div className="lp-brand"><Logo /><span>RCT Platform</span></div>
        <nav className="lp-navlinks">
          <a href="#about">소개</a>
          <a href="#how">이용방법</a>
          <a href="#network">네트워크</a>
          <Link href="/login" className="lp-login-btn">로그인</Link>
        </nav>
      </header>

      {/* ── 화면 1·2 스냅 컨테이너(중첩 스크롤) — 노드→나비만 자석 스냅, 그 아래는 자유 스크롤 ── */}
      <div className="lp-snapwrap">
      <section className="lp-hero lp-snap">
        <div className="lp-hero-glow" />
        <div className="lp-hero-grid">
          <div className="lp-hero-text">
            <span className="lp-badge">System Active_</span>
            <h1 className="lp-h1">{/* [placeholder] */}자동 거래로 완성하는<br />새로운 수익의 기준</h1>
            <p className="lp-subhead">{/* [placeholder] */}여기에 회사를 한 문장으로 설명하는 카피가 들어갑니다. 링크 하나로 소개와 시작까지.</p>
            <div className="lp-cta-group">
              <Link href="/login" className="lp-metal-btn" aria-label="시작하기">
                <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Link>
              <span className="lp-cta-text">플랫폼 시작하기</span>
            </div>
          </div>
          <div className="lp-canvas">
            <div className="lp-backdrop" />
            <div className="lp-scene">
              <svg className="lp-splines" viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice">
                {SPLINES.map((d, i) => (
                  <g key={i}><path className="lp-spline-glow" d={d} /><path className="lp-spline-path" d={d} /></g>
                ))}
              </svg>
              {['NODE_01', 'NODE_02', 'NODE_03', 'NODE_04'].map((lbl, i) => (
                <div key={i} className={`lp-node lp-node-${i + 1}`}>
                  <div className="lp-card-head">
                    <div className="lp-avatar" />
                    <div style={{ flex: 1 }}><div className="lp-card-title" /><div className="lp-card-meta" /></div>
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
        <a href="#network" className="lp-scrollcue">SCROLL ↓</a>
      </section>

      {/* ── 화면 2: 나비 애니메이션 ── */}
      <section id="network" className="bfy lp-snap">
        <div className="bfy-scanline" />
        <div className="bfy-dot" />
        <div className="bfy-canvas"><ButterflyCanvas /></div>
        <div className="bfy-overlay">
          <main className="bfy-hero">
            <span className="bfy-tag">{/* [placeholder] */}// AUTOMATED COPY TRADING NETWORK</span>
            <h1 className="bfy-h1">자동 거래로 잇는<br /><em>새로운 수익</em>의 구조.</h1>
            <div className="bfy-actions">
              <Link href="/login" className="bfy-btn">Open Terminal</Link>
              <div className="bfy-stat"><span className="v">0.0001s</span><span className="l">Execution Latency</span></div>
              <div className="bfy-stat"><span className="v">24/7</span><span className="l">Real-time Settlement</span></div>
            </div>
          </main>
          <div className="bfy-floating">
            <div className="bfy-fstat"><span className="v">$412.8M</span><span className="l">Total Volume</span></div>
            <div className="bfy-fstat"><span className="v">12.4k</span><span className="l">Active Members</span></div>
          </div>
          <div className="bfy-features">
            {[
              { n: '01 // KINETIC', t: '자동 거래', d: '[placeholder] 고정밀 자동 거래 시스템 설명.' },
              { n: '02 // ADAPTIVE', t: '투명한 정산', d: '[placeholder] 월간 수익 정산·투명성 설명.' },
              { n: '03 // PRISMATIC', t: '보상 플랜', d: '[placeholder] 추천/직급 보상 플랜 설명.' },
            ].map((f, i) => (
              <div key={i} className="bfy-fcard"><span className="num">{f.n}</span><h3>{f.t}</h3><p>{f.d}</p></div>
            ))}
          </div>
        </div>
      </section>
      </div>

      {/* ── 콘텐츠 ── */}
      <section id="about" className="lp-section">
        <span className="lp-kicker">ABOUT</span>
        <h2 className="lp-h2">RCT Platform이란?</h2>
        <p className="lp-lead">여기에 회사 소개가 들어갑니다. 어떤 문제를 해결하는지, 왜 신뢰할 수 있는지 간결하게 설명하는 자리입니다.</p>
      </section>
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
            <div key={i} className="lp-step"><span className="lp-step-n">{s.n}</span><h4>{s.t}</h4><p>{s.d}</p></div>
          ))}
        </div>
      </section>
      <section className="lp-cta">
        <h2>지금 시작해보세요</h2>
        <p>가입 후 바로 이용할 수 있습니다.</p>
        <Link href="/login" className="lp-btn-primary lg">로그인 / 시작하기 →</Link>
      </section>
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
.lp { --acc:#4db6ac; background:#07080a; color:#e0e6ed; font-family:var(--font-main); }
.lp a { text-decoration:none; color:inherit; }
.lp em { font-style:normal; color:var(--acc); opacity:0.85; }

/* 노드→나비 스냅 컨테이너: 이 안에서만 자석처럼 스냅, 다 보면 아래 콘텐츠로 자연스럽게 이어짐 */
.lp-snapwrap { height:100vh; overflow-y:auto; scroll-snap-type:y mandatory; scroll-behavior:smooth;
  scrollbar-width:none; -ms-overflow-style:none; }
.lp-snapwrap::-webkit-scrollbar { display:none; }
.lp-snap { scroll-snap-align:start; scroll-snap-stop:always; }

/* 네비 */
.lp-nav { position:fixed; top:0; left:0; right:0; width:100%; z-index:80; display:flex; align-items:center; justify-content:space-between;
  padding:16px 32px; background:rgba(7,8,10,0.72); backdrop-filter:blur(10px); border-bottom:1px solid rgba(148,163,184,0.08); }
.lp-brand { display:flex; align-items:center; gap:9px; font-weight:700; font-size:15px; }
.lp-brand.small { font-size:13px; opacity:0.8; }
.lp-navlinks { display:flex; align-items:center; gap:26px; font-size:14px; color:#94a3b8; }
.lp-navlinks a:hover { color:#e0e6ed; }
.lp-login-btn { border:1px solid var(--acc); color:var(--acc) !important; padding:8px 20px; border-radius:999px;
  font-weight:600; background:rgba(77,182,172,0.05); transition:all .2s; }
.lp-login-btn:hover { background:var(--acc); color:#07080a !important; box-shadow:0 0 16px rgba(77,182,172,0.3); }

/* 화면 1: 노드 */
.lp-hero { position:relative; overflow:hidden; height:100vh; display:flex; flex-direction:column; justify-content:center; padding:40px 40px 60px; }
.lp-hero-glow { position:absolute; top:0; left:15%; width:700px; height:520px; background:radial-gradient(circle, rgba(77,182,172,0.08) 0%, transparent 65%); filter:blur(50px); pointer-events:none; }
.lp-hero-grid { position:relative; max-width:1400px; margin:0 auto; width:100%; display:grid; grid-template-columns:1fr 1.2fr; gap:60px; align-items:center; }
.lp-hero-text { display:flex; flex-direction:column; justify-content:center; z-index:10; }
.lp-badge { display:inline-flex; align-items:center; padding:6px 12px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:999px; font-size:12px; color:#9ea3aa; margin-bottom:22px; width:fit-content; letter-spacing:0.04em; text-transform:uppercase; font-family:var(--font-mono); }
.lp-h1 { font-size:60px; line-height:1.1; font-weight:300; letter-spacing:-0.03em; margin-bottom:22px; background:linear-gradient(180deg,#fff 0%, rgba(255,255,255,0.5) 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.lp-subhead { font-size:18px; line-height:1.6; color:#9ea3aa; font-weight:300; max-width:470px; margin-bottom:40px; }
.lp-cta-group { display:flex; align-items:center; gap:20px; }
.lp-cta-text { font-size:15px; font-weight:500; color:#f4f5f6; }
.lp-metal-btn { display:flex; align-items:center; justify-content:center; width:64px; height:64px; border-radius:50%; background:radial-gradient(circle at 30% 30%, #f0f0f0 0%, #d1d3d6 50%, #a3a5a8 100%); border:none; cursor:pointer; box-shadow:-4px -4px 12px rgba(255,255,255,0.05), 8px 8px 24px rgba(0,0,0,0.4), inset -2px -2px 6px rgba(0,0,0,0.15), inset 2px 2px 6px rgba(255,255,255,0.9); transition:transform .2s cubic-bezier(0.34,1.56,0.64,1); }
.lp-metal-btn svg { width:24px; height:24px; stroke:#111; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; fill:none; filter:drop-shadow(0 1px 0 rgba(255,255,255,0.4)); }
.lp-metal-btn:hover { transform:scale(1.05); } .lp-metal-btn:active { transform:scale(0.95); }
.lp-scrollcue { position:absolute; bottom:26px; left:50%; transform:translateX(-50%); font-family:var(--font-mono); font-size:10px; letter-spacing:0.25em; color:#64748b; animation:lp-bob 2s ease-in-out infinite; }
@keyframes lp-bob { 0%,100% { transform:translateX(-50%) translateY(0); } 50% { transform:translateX(-50%) translateY(6px); } }

.lp-canvas { position:relative; display:flex; align-items:center; justify-content:center; perspective:1200px; min-height:520px; }
.lp-backdrop { position:absolute; inset:40px -20px -20px 20px; border-radius:48px; background:linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%); border-top:1px solid rgba(255,255,255,0.06); border-left:1px solid rgba(255,255,255,0.06); backdrop-filter:blur(40px); box-shadow:-20px -20px 60px rgba(255,255,255,0.02), 40px 40px 80px rgba(0,0,0,0.4); transform:rotateY(-15deg) rotateX(5deg) translateZ(-100px); transform-style:preserve-3d; pointer-events:none; }
.lp-scene { position:relative; width:100%; height:520px; transform-style:preserve-3d; transform:rotateY(-15deg) rotateX(5deg); }
.lp-splines { position:absolute; inset:0; width:100%; height:100%; z-index:1; }
.lp-spline-path { fill:none; stroke:rgba(77,182,172,0.15); stroke-width:1.5; stroke-dasharray:6 6; animation:lp-flow 20s linear infinite; }
.lp-spline-glow { fill:none; stroke:rgba(255,255,255,0.05); stroke-width:8; filter:blur(4px); }
@keyframes lp-flow { to { stroke-dashoffset:-100; } }
.lp-node { position:absolute; width:200px; height:120px; padding:12px; z-index:2; background:rgba(255,255,255,0.03); backdrop-filter:blur(16px) saturate(150%); border:1px solid rgba(255,255,255,0.08); border-top:1px solid rgba(255,255,255,0.15); border-radius:20px; box-shadow:0 24px 48px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1); display:flex; flex-direction:column; justify-content:space-between; transition:border-color .4s ease; }
.lp-node:hover { border-color:rgba(77,182,172,0.5); }
.lp-card-head { display:flex; align-items:center; gap:8px; }
.lp-avatar { width:20px; height:20px; border-radius:50%; background:rgba(255,255,255,0.1); }
.lp-card-title { height:4px; width:60%; background:rgba(255,255,255,0.2); border-radius:2px; }
.lp-card-meta { height:4px; width:40%; background:rgba(255,255,255,0.1); border-radius:2px; margin-top:6px; }
.lp-play { align-self:flex-end; width:24px; height:24px; border-radius:50%; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; }
.lp-play::after { content:''; width:0; height:0; border-style:solid; border-width:4px 0 4px 6px; border-color:transparent transparent transparent #fff; margin-left:2px; }
.lp-node-1 { top:10%; left:6%; --tz:30px; animation:lp-float 6s ease-in-out infinite; }
.lp-node-2 { top:60%; left:2%; --tz:10px; animation:lp-float 8s ease-in-out infinite 1s; }
.lp-node-3 { top:12%; right:8%; --tz:40px; animation:lp-float 7s ease-in-out infinite 2s; }
.lp-node-4 { top:66%; right:4%; --tz:20px; animation:lp-float 9s ease-in-out infinite .5s; }
@keyframes lp-float { 0%,100% { transform:translateY(0) translateZ(var(--tz,20px)); } 50% { transform:translateY(-12px) translateZ(var(--tz,20px)); } }
.lp-insight { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) translateZ(80px); width:140px; height:140px; border-radius:50%; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); box-shadow:0 32px 64px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; z-index:10; }
.lp-core { width:80px; height:80px; border-radius:50%; position:relative; display:flex; align-items:center; justify-content:center; background:radial-gradient(circle at 30% 30%, #f0f0f0 0%, #d1d3d6 60%, #a3a5a8 100%); box-shadow:-4px -4px 12px rgba(255,255,255,0.05), 8px 8px 24px rgba(0,0,0,0.3), inset -2px -2px 6px rgba(0,0,0,0.2), inset 2px 2px 6px rgba(255,255,255,0.9); }
.lp-core::before { content:''; position:absolute; inset:-12px; border-radius:50%; border:1px solid rgba(77,182,172,0.35); animation:lp-pulse 4s cubic-bezier(0.4,0,0.6,1) infinite; }
.lp-core::after { content:''; position:absolute; inset:-12px; border-radius:50%; border:1px solid rgba(77,182,172,0.2); animation:lp-pulse 4s cubic-bezier(0.4,0,0.6,1) infinite 2s; }
@keyframes lp-pulse { 0% { transform:scale(1); opacity:1; } 100% { transform:scale(1.6); opacity:0; } }
.lp-meta-lbl { position:absolute; font-size:10px; font-family:var(--font-mono); color:rgba(255,255,255,0.4); letter-spacing:0.1em; pointer-events:none; }
.lp-lbl-1 { bottom:-20px; left:50%; transform:translateX(-50%); }
.lp-lbl-2 { top:-26px; left:50%; transform:translateX(-50%); }

/* 화면 2: 나비 */
.bfy { position:relative; height:100vh; overflow:hidden; background:radial-gradient(circle at 50% 45%, #0a0a0f 0%, #030303 70%); }
.bfy-scanline { position:absolute; inset:0; z-index:60; pointer-events:none; opacity:0.3; background:linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.1) 50%); background-size:100% 4px; }
.bfy-dot { position:absolute; inset:0; z-index:2; pointer-events:none; background-image:radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px); background-size:40px 40px; }
.bfy-canvas { position:absolute; inset:0; z-index:1; }
.bfy-overlay { position:relative; z-index:10; min-height:100vh; display:flex; flex-direction:column; padding:64px; pointer-events:none; }
.bfy-overlay > * { pointer-events:auto; }
.bfy-hero { max-width:760px; margin-top:40px; }
.bfy-tag { font-family:var(--font-mono); font-size:10px; color:var(--acc); margin-bottom:22px; display:block; opacity:0.85; letter-spacing:0.08em; }
.bfy-h1 { font-family:'Noto Serif KR', serif; font-weight:300; font-size:72px; line-height:1.05; letter-spacing:-0.02em; margin-bottom:40px; }
.bfy-actions { display:flex; align-items:center; gap:36px; flex-wrap:wrap; }
.bfy-btn { border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.02); backdrop-filter:blur(10px); color:#fff; padding:18px 38px; font-family:var(--font-mono); font-size:11px; text-transform:uppercase; letter-spacing:0.2em; transition:all .3s; }
.bfy-btn:hover { border-color:var(--acc); background:rgba(77,182,172,0.06); }
.bfy-stat { display:flex; flex-direction:column; gap:4px; }
.bfy-stat .v { font-family:var(--font-mono); font-size:14px; color:var(--acc); }
.bfy-stat .l { font-size:9px; text-transform:uppercase; letter-spacing:0.1em; color:rgba(255,255,255,0.4); }
.bfy-floating { position:absolute; right:64px; top:34%; display:flex; flex-direction:column; gap:52px; text-align:right; }
.bfy-fstat .v { font-family:'Noto Serif KR', serif; font-size:40px; font-weight:300; display:block; }
.bfy-fstat .l { font-family:var(--font-mono); font-size:10px; text-transform:uppercase; color:rgba(255,255,255,0.4); letter-spacing:0.1em; }
.bfy-features { display:grid; grid-template-columns:repeat(3,1fr); gap:1px; background:rgba(255,255,255,0.08); margin-top:auto; border:1px solid rgba(255,255,255,0.08); }
.bfy-fcard { background:#030303; padding:36px; transition:background .3s; }
.bfy-fcard:hover { background:#080808; }
.bfy-fcard .num { font-family:var(--font-mono); font-size:9px; color:rgba(255,255,255,0.4); margin-bottom:26px; display:block; letter-spacing:0.1em; }
.bfy-fcard h3 { font-family:'Noto Serif KR', serif; font-size:24px; font-weight:300; margin-bottom:14px; }
.bfy-fcard p { font-size:13px; color:rgba(255,255,255,0.4); line-height:1.6; max-width:280px; }

/* 콘텐츠 */
.lp-section { max-width:1080px; margin:0 auto; padding:90px 32px; }
.lp-kicker { font-family:var(--font-mono); font-size:11px; letter-spacing:0.28em; color:var(--acc); }
.lp-h2 { font-family:'Noto Serif KR', serif; font-size:34px; font-weight:400; margin:10px 0 22px; }
.lp-lead { font-size:16px; color:rgba(255,255,255,0.55); line-height:1.8; max-width:720px; }
.lp-steps { display:grid; grid-template-columns:repeat(4,1fr); gap:18px; margin-top:26px; }
.lp-step { border-left:2px solid rgba(77,182,172,0.3); padding:6px 0 6px 18px; }
.lp-step-n { font-family:var(--font-mono); font-size:22px; font-weight:700; color:var(--acc); }
.lp-step h4 { font-size:16px; font-weight:700; margin:8px 0 6px; }
.lp-step p { font-size:13px; color:rgba(255,255,255,0.45); line-height:1.6; }
.lp-cta { text-align:center; padding:90px 32px; max-width:1080px; margin:0 auto; border-top:1px solid rgba(255,255,255,0.08); border-bottom:1px solid rgba(255,255,255,0.08); background:linear-gradient(180deg, rgba(77,182,172,0.06), transparent); }
.lp-cta h2 { font-family:'Noto Serif KR', serif; font-size:32px; font-weight:400; }
.lp-cta p { color:rgba(255,255,255,0.5); margin:12px 0 26px; }
.lp-btn-primary { display:inline-block; background:var(--acc); color:#07080a; font-weight:700; padding:15px 40px; border-radius:6px; transition:all .2s; }
.lp-btn-primary:hover { box-shadow:0 8px 24px rgba(77,182,172,0.3); transform:translateY(-2px); }
.lp-footer { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:14px; max-width:1080px; margin:0 auto; padding:30px 32px 50px; }
.lp-foot-meta { display:flex; flex-direction:column; gap:4px; font-size:12px; color:rgba(255,255,255,0.35); text-align:right; }

/* 반응형 */
@media (max-width:1024px) {
  .lp-hero-grid { grid-template-columns:1fr; gap:40px; }
  .lp-canvas { perspective:none; min-height:420px; order:-1; }
  .lp-scene { transform:none; height:420px; }
  .lp-backdrop { transform:none; inset:20px 0 0 0; }
  .lp-node { --tz:0px !important; } .lp-insight { transform:translate(-50%,-50%); }
  .bfy-floating { display:none; }
}
@media (max-width:768px) {
  .lp-nav { padding:12px 18px; } .lp-navlinks { gap:14px; font-size:13px; }
  .lp-navlinks a:not(.lp-login-btn) { display:none; }
  .lp-h1 { font-size:38px; } .lp-subhead { font-size:16px; }
  .lp-node { width:150px; height:96px; }
  .bfy-overlay { padding:28px 20px; } .bfy-h1 { font-size:40px; } .bfy-features { grid-template-columns:1fr; }
  .lp-section { padding:60px 20px; } .lp-steps { grid-template-columns:1fr; }
  .lp-footer { flex-direction:column; align-items:flex-start; } .lp-foot-meta { text-align:left; }
}
`
