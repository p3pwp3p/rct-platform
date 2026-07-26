'use client'
import { useEffect } from 'react'
import Link from 'next/link'

/**
 * 랜딩(홈) — Butterfly.fi 무드(딥블랙·세리프 헤드라인·모노 라벨·스캔라인/도트매트릭스·
 * 터미널 버튼·플로팅 스탯·피처 그리드) + 노드 애니메이션 UI(글래스 노드·스플라인·코어 pulse)를
 * 중앙 비주얼로 유지. 브랜드(RCT 로고/틸)로 커스텀. 콘텐츠는 [placeholder].
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

      {/* ── 히어로 스크린 (Butterfly 무드) ── */}
      <section className="bfy">
        <div className="bfy-scanline" />
        <div className="bfy-dot" />

        {/* 노드 애니메이션 (중앙 비주얼) */}
        <div className="bfy-canvas">
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

        {/* 오버레이 */}
        <div className="bfy-overlay">
          <nav className="bfy-nav">
            <div className="bfy-logo"><span className="bfy-logo-box" /> RCT PLATFORM / V.1.0</div>
            <div className="bfy-navlinks">
              <a href="#about">ABOUT</a>
              <a href="#how">PLATFORM</a>
              <a href="#features">SOLUTION</a>
              <Link href="/login">LOGIN</Link>
            </div>
            <div className="bfy-sys">SYS_STATUS: ACTIVE</div>
          </nav>

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
              { n: '01 // KINETIC', t: '자동 거래', d: '[placeholder] 고정밀 자동 거래 시스템에 대한 설명이 들어갑니다.' },
              { n: '02 // ADAPTIVE', t: '투명한 정산', d: '[placeholder] 월간 수익 정산과 투명성에 대한 설명.' },
              { n: '03 // PRISMATIC', t: '보상 플랜', d: '[placeholder] 추천/직급 보상 플랜에 대한 설명.' },
            ].map((f, i) => (
              <div key={i} className="bfy-fcard">
                <span className="num">{f.n}</span>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 추가 섹션(콘텐츠용) ── */}
      <section id="about" className="lp-section">
        <span className="lp-kicker">ABOUT</span>
        <h2 className="lp-h2">RCT Platform이란?</h2>
        <p className="lp-lead">여기에 회사 소개가 들어갑니다. 어떤 문제를 해결하는지, 왜 신뢰할 수 있는지 간결하게 설명하는 자리입니다. 콘티가 확정되면 이 문단을 교체하세요.</p>
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
        <div className="bfy-logo"><span className="bfy-logo-box" /> RCT PLATFORM</div>
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
.lp { --acc:#4db6ac; background:#030303; color:#fff; font-family:var(--font-main); min-height:100vh; }
.lp a { text-decoration:none; color:inherit; }
.lp em { font-style:normal; color:var(--acc); opacity:0.85; }

/* ── 히어로 스크린 ── */
.bfy { position:relative; min-height:100vh; overflow:hidden;
  background:radial-gradient(circle at 50% 45%, #0a0a0f 0%, #030303 70%); }
.bfy-scanline { position:absolute; inset:0; z-index:60; pointer-events:none; opacity:0.3;
  background:linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.1) 50%); background-size:100% 4px; }
.bfy-dot { position:absolute; inset:0; z-index:2; pointer-events:none;
  background-image:radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px); background-size:40px 40px; }

/* 노드 씬 (중앙 비주얼) */
.bfy-canvas { position:absolute; inset:0; z-index:1; display:flex; align-items:center; justify-content:center; perspective:1200px; }
.lp-scene { position:relative; width:680px; height:600px; transform-style:preserve-3d; transform:rotateY(-15deg) rotateX(6deg); opacity:0.9; }
.lp-splines { position:absolute; inset:0; width:100%; height:100%; z-index:1; }
.lp-spline-path { fill:none; stroke:rgba(228,191,255,0.14); stroke-width:1.5; stroke-dasharray:6 6; animation:lp-flow 20s linear infinite; }
.lp-spline-glow { fill:none; stroke:rgba(77,182,172,0.06); stroke-width:8; filter:blur(4px); }
@keyframes lp-flow { to { stroke-dashoffset:-100; } }

.lp-node { position:absolute; width:190px; height:112px; padding:12px; z-index:2;
  background:rgba(255,255,255,0.03); backdrop-filter:blur(16px) saturate(150%);
  border:1px solid rgba(255,255,255,0.08); border-top:1px solid rgba(255,255,255,0.15); border-radius:18px;
  box-shadow:0 24px 48px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.1);
  display:flex; flex-direction:column; justify-content:space-between; transition:border-color .4s ease; }
.lp-node:hover { border-color:var(--acc); }
.lp-card-head { display:flex; align-items:center; gap:8px; }
.lp-avatar { width:20px; height:20px; border-radius:50%; background:rgba(255,255,255,0.1); }
.lp-card-title { height:4px; width:60%; background:rgba(255,255,255,0.2); border-radius:2px; }
.lp-card-meta { height:4px; width:40%; background:rgba(255,255,255,0.1); border-radius:2px; margin-top:6px; }
.lp-play { align-self:flex-end; width:24px; height:24px; border-radius:50%; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; }
.lp-play::after { content:''; width:0; height:0; border-style:solid; border-width:4px 0 4px 6px; border-color:transparent transparent transparent #fff; margin-left:2px; }
.lp-node-1 { top:8%; left:2%; --tz:30px; animation:lp-float 6s ease-in-out infinite; }
.lp-node-2 { top:62%; left:-2%; --tz:10px; animation:lp-float 8s ease-in-out infinite 1s; }
.lp-node-3 { top:10%; right:2%; --tz:40px; animation:lp-float 7s ease-in-out infinite 2s; }
.lp-node-4 { top:66%; right:-2%; --tz:20px; animation:lp-float 9s ease-in-out infinite .5s; }
@keyframes lp-float { 0%,100% { transform:translateY(0) translateZ(var(--tz,20px)); } 50% { transform:translateY(-12px) translateZ(var(--tz,20px)); } }

.lp-insight { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) translateZ(80px);
  width:140px; height:140px; border-radius:50%; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1);
  box-shadow:0 32px 64px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; z-index:10; }
.lp-core { width:80px; height:80px; border-radius:50%; position:relative; display:flex; align-items:center; justify-content:center;
  background:radial-gradient(circle at 30% 30%, #f0f0f0 0%, #d1d3d6 60%, #a3a5a8 100%);
  box-shadow:-4px -4px 12px rgba(255,255,255,0.05), 8px 8px 24px rgba(0,0,0,0.3), inset -2px -2px 6px rgba(0,0,0,0.2), inset 2px 2px 6px rgba(255,255,255,0.9); }
.lp-core::before { content:''; position:absolute; inset:-12px; border-radius:50%; border:1px solid rgba(77,182,172,0.35); animation:lp-pulse 4s cubic-bezier(0.4,0,0.6,1) infinite; }
.lp-core::after { content:''; position:absolute; inset:-12px; border-radius:50%; border:1px solid rgba(228,191,255,0.3); animation:lp-pulse 4s cubic-bezier(0.4,0,0.6,1) infinite 2s; }
@keyframes lp-pulse { 0% { transform:scale(1); opacity:1; } 100% { transform:scale(1.6); opacity:0; } }
.lp-meta-lbl { position:absolute; font-size:10px; font-family:var(--font-mono); color:rgba(255,255,255,0.4); letter-spacing:0.1em; pointer-events:none; }
.lp-lbl-1 { bottom:-20px; left:50%; transform:translateX(-50%); }
.lp-lbl-2 { top:-26px; left:50%; transform:translateX(-50%); }

/* 오버레이 */
.bfy-overlay { position:relative; z-index:10; min-height:100vh; display:flex; flex-direction:column; padding:44px 64px; pointer-events:none; }
.bfy-overlay > * { pointer-events:auto; }
.bfy-nav { display:flex; justify-content:space-between; align-items:center; margin-bottom:96px; }
.bfy-logo { font-family:var(--font-mono); font-size:12px; letter-spacing:0.2em; display:flex; align-items:center; gap:12px; }
.bfy-logo-box { width:8px; height:8px; background:var(--acc); box-shadow:0 0 15px var(--acc); }
.bfy-navlinks { display:flex; gap:36px; }
.bfy-navlinks a { font-size:10px; text-transform:uppercase; letter-spacing:0.15em; color:rgba(255,255,255,0.4); transition:color .3s; }
.bfy-navlinks a:hover { color:#fff; }
.bfy-sys { font-family:var(--font-mono); font-size:10px; color:rgba(255,255,255,0.4); letter-spacing:0.15em; }

.bfy-hero { max-width:760px; }
.bfy-tag { font-family:var(--font-mono); font-size:10px; color:var(--acc); margin-bottom:22px; display:block; opacity:0.85; letter-spacing:0.08em; }
.bfy-h1 { font-family:'Noto Serif KR', serif; font-weight:300; font-size:76px; line-height:1.05; letter-spacing:-0.02em; margin-bottom:40px; }
.bfy-actions { display:flex; align-items:center; gap:36px; flex-wrap:wrap; }
.bfy-btn { border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.02); backdrop-filter:blur(10px);
  color:#fff; padding:18px 38px; font-family:var(--font-mono); font-size:11px; text-transform:uppercase; letter-spacing:0.2em; transition:all .3s; }
.bfy-btn:hover { border-color:var(--acc); background:rgba(77,182,172,0.06); }
.bfy-stat { display:flex; flex-direction:column; gap:4px; }
.bfy-stat .v { font-family:var(--font-mono); font-size:14px; color:var(--acc); }
.bfy-stat .l { font-size:9px; text-transform:uppercase; letter-spacing:0.1em; color:rgba(255,255,255,0.4); }

.bfy-floating { position:absolute; right:64px; top:36%; display:flex; flex-direction:column; gap:52px; text-align:right; }
.bfy-fstat .v { font-family:'Noto Serif KR', serif; font-size:40px; font-weight:300; display:block; }
.bfy-fstat .l { font-family:var(--font-mono); font-size:10px; text-transform:uppercase; color:rgba(255,255,255,0.4); letter-spacing:0.1em; }

.bfy-features { display:grid; grid-template-columns:repeat(3,1fr); gap:1px; background:rgba(255,255,255,0.08);
  margin-top:auto; border:1px solid rgba(255,255,255,0.08); }
.bfy-fcard { background:#030303; padding:36px; transition:background .3s; }
.bfy-fcard:hover { background:#080808; }
.bfy-fcard .num { font-family:var(--font-mono); font-size:9px; color:rgba(255,255,255,0.4); margin-bottom:26px; display:block; letter-spacing:0.1em; }
.bfy-fcard h3 { font-family:'Noto Serif KR', serif; font-size:24px; font-weight:300; margin-bottom:14px; }
.bfy-fcard p { font-size:13px; color:rgba(255,255,255,0.4); line-height:1.6; max-width:280px; }

/* ── 하위 섹션 ── */
.lp-section { max-width:1080px; margin:0 auto; padding:90px 32px; }
.lp-kicker { font-family:var(--font-mono); font-size:11px; letter-spacing:0.28em; color:var(--acc); }
.lp-h2 { font-family:'Noto Serif KR', serif; font-size:34px; font-weight:400; margin:10px 0 22px; }
.lp-lead { font-size:16px; color:rgba(255,255,255,0.55); line-height:1.8; max-width:720px; }
.lp-steps { display:grid; grid-template-columns:repeat(4,1fr); gap:18px; margin-top:26px; }
.lp-step { border-left:2px solid rgba(77,182,172,0.3); padding:6px 0 6px 18px; }
.lp-step-n { font-family:var(--font-mono); font-size:22px; font-weight:700; color:var(--acc); }
.lp-step h4 { font-size:16px; font-weight:700; margin:8px 0 6px; }
.lp-step p { font-size:13px; color:rgba(255,255,255,0.45); line-height:1.6; }
.lp-cta { text-align:center; padding:90px 32px; max-width:1080px; margin:0 auto;
  border-top:1px solid rgba(255,255,255,0.08); border-bottom:1px solid rgba(255,255,255,0.08);
  background:linear-gradient(180deg, rgba(77,182,172,0.06), transparent); }
.lp-cta h2 { font-family:'Noto Serif KR', serif; font-size:32px; font-weight:400; }
.lp-cta p { color:rgba(255,255,255,0.5); margin:12px 0 26px; }
.lp-btn-primary { display:inline-block; background:var(--acc); color:#030303; font-weight:700; padding:15px 40px; border-radius:6px; transition:all .2s; }
.lp-btn-primary:hover { box-shadow:0 8px 24px rgba(77,182,172,0.3); transform:translateY(-2px); }
.lp-footer { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:14px; max-width:1080px; margin:0 auto; padding:30px 32px 50px; }
.lp-foot-meta { display:flex; flex-direction:column; gap:4px; font-size:12px; color:rgba(255,255,255,0.35); text-align:right; }

/* 반응형 */
@media (max-width:1100px) {
  .bfy-floating { display:none; }
  .bfy-canvas { opacity:0.5; }
}
@media (max-width:820px) {
  .bfy-overlay { padding:28px 22px; }
  .bfy-nav { margin-bottom:56px; }
  .bfy-navlinks { gap:16px; }
  .bfy-navlinks a:not(:last-child) { display:none; }
  .bfy-sys { display:none; }
  .bfy-h1 { font-size:44px; }
  .bfy-features { grid-template-columns:1fr; }
  .lp-scene { transform:none; width:100%; }
  .lp-node { --tz:0px !important; }
  .lp-insight { transform:translate(-50%,-50%); }
  .lp-section { padding:60px 20px; }
  .lp-steps { grid-template-columns:1fr; }
  .lp-footer { flex-direction:column; align-items:flex-start; } .lp-foot-meta { text-align:left; }
}
`
