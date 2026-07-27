'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import ButterflyCanvas from '@/components/ButterflyCanvas'

/**
 * 랜딩(홈) — 스크롤 2단 구성.
 *  1) 첫 화면: 노드 애니메이션(글래스 노드·스플라인·코어 고리 pulse)
 *  2) 스크롤: 나비 궤적 애니메이션(Butterfly 무드) 화면으로 전환
 * 브랜드(RCT 로고/틸), SUIT 단일 서체 체계. 콘텐츠는 [placeholder].
 *
 * 전환 방식: 브라우저 네이티브 스크롤 스냅(scroll-snap-type: mandatory).
 * 커스텀 휠 가로채기/JS 트랜지션 없음 → 트랙패드·마우스·터치 어디서든
 * 브라우저가 최적화해 매끄럽고, 접근성·기기 호환성 리스크도 없음.
 * 나비 조립/분해는 IntersectionObserver 로 그 섹션 진입/이탈마다 반복 트리거.
 *
 * 노출 스위치: 프로덕션(Vercel 미설정)에선 /login 으로. 로컬(.env.local=true)에서만 랜딩.
 */
const LANDING_ENABLED = process.env.NEXT_PUBLIC_LANDING_ENABLED === 'true'

export default function LandingPage() {
  const bfySectionRef = useRef<HTMLElement>(null)
  const [bfyActive, setBfyActive] = useState(false)

  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery')) { window.location.replace('/reset-password' + hash); return }
    if (hash.includes('type=signup') || hash.includes('type=email')) { window.location.replace('/auth/confirm' + hash); return }
    if (!LANDING_ENABLED) window.location.replace('/login')
  }, [])

  // 나비 섹션에 절반 이상 들어오면 조립, 벗어나면(위/아래 어느 방향이든) 분해 — 반복 재생.
  useEffect(() => {
    if (!LANDING_ENABLED) return
    const el = bfySectionRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => setBfyActive(entries[0]?.isIntersecting ?? false),
      { threshold: 0.5 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const goNetwork = () => bfySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  if (!LANDING_ENABLED) return null

  return (
    <div className="lp">
      <style>{CSS}</style>

      {/* 상단 네비 (양 화면 공통, 오버레이) */}
      <header className="lp-nav">
        <div className="lp-brand"><Logo /><span>RCT Platform</span></div>
        <nav className="lp-navlinks">
          <a href="#how">이용방법</a>
          <button type="button" onClick={goNetwork} className="lp-navlink-btn">네트워크</button>
          <Link href="/login" className="lp-login-btn">로그인</Link>
        </nav>
      </header>

      {/* ── 화면 1·2 — 브라우저 네이티브 스크롤 스냅(mandatory), 그 아래는 자유 스크롤 ── */}
      <div className="lp-snapwrap">
        {/* 화면 1: 노드 애니메이션 */}
        <section className="lp-hero lp-snap">
          <div className="lp-hero-glow" />
          <div className="lp-hero-grid">
            <div className="lp-hero-text">
              <span className="lp-tag">{/* [placeholder] */}SYSTEM ACTIVE</span>
              <h1 className="lp-h1">{/* [placeholder] */}자동 거래로 완성하는<br />새로운 수익의 기준</h1>
              <p className="lp-subhead">{/* [placeholder] */}여기에 회사를 한 문장으로 설명하는 카피가 들어갑니다. 링크 하나로 소개와 시작까지.</p>
              <div className="lp-cta-group">
                <Link href="/login" className="lp-glass-btn">
                  플랫폼 시작하기
                  <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </Link>
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
          <button type="button" onClick={goNetwork} className="lp-scrollcue">
            <span>SCROLL</span>
            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
          </button>
        </section>

        {/* 화면 2: 나비 애니메이션 — 섹션 진입/이탈마다 조립/분해 반복 */}
        <section className="bfy lp-snap" ref={bfySectionRef}>
          <div className="bfy-dot" />
          <div className="bfy-canvas"><ButterflyCanvas active={bfyActive} /></div>
          <div className="bfy-overlay">
            <main className="bfy-hero">
              <span className="lp-tag">{/* [placeholder] */}AUTOMATED COPY TRADING NETWORK</span>
              <h1 className="bfy-h1">자동 거래로 잇는<br /><em>새로운 수익</em>의 구조</h1>
              <div className="bfy-actions">
                <Link href="/login" className="lp-glass-btn">
                  Open Terminal
                  <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </Link>
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
                { n: '01', k: 'KINETIC', t: '자동 거래', d: '[placeholder] 고정밀 자동 거래 시스템 설명.' },
                { n: '02', k: 'ADAPTIVE', t: '투명한 정산', d: '[placeholder] 월간 수익 정산·투명성 설명.' },
                { n: '03', k: 'PRISMATIC', t: '보상 플랜', d: '[placeholder] 추천/직급 보상 플랜 설명.' },
              ].map((f, i) => (
                <div key={i} className="bfy-fcard">
                  <span className="num">{f.n} <em>{f.k}</em></span>
                  <h3>{f.t}</h3>
                  <p>{f.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ── 콘텐츠 ── */}
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
        <Link href="/login" className="lp-btn-primary">로그인 / 시작하기 →</Link>
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
      stroke={dark ? '#0a0a0a' : '#4db6ac'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
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
.lp { --acc:#4db6ac; --acc-2:#7dd8cf; background:#050607; color:#f4f5f6; font-family:var(--font-main); }
.lp a, .lp button { text-decoration:none; color:inherit; font-family:inherit; }
.lp button { border:none; background:none; cursor:pointer; }
.lp em { font-style:normal; color:var(--acc); }

/* 공용 타이포 토큰 */
.lp-tag { font-family:var(--font-mono); font-size:11px; color:var(--acc); letter-spacing:0.24em;
  text-transform:uppercase; opacity:0.9; display:block; margin-bottom:24px; }
.lp-kicker { font-family:var(--font-mono); font-size:11px; letter-spacing:0.28em; color:var(--acc); text-transform:uppercase; }

/* 화면 1·2 스냅 컨테이너 — 브라우저 네이티브 scroll-snap(mandatory).
   이 안에서만 "한 번 스크롤 = 다음 화면" 스냅, 그 아래 콘텐츠는 자유 스크롤
   (전체 문서에 걸면 마지막 스냅 지점 이후로 못 내려가는 함정이 있어 분리). */
.lp-snapwrap { height:100vh; overflow-y:auto; scroll-snap-type:y mandatory; scroll-behavior:smooth;
  scrollbar-width:none; -ms-overflow-style:none; background:#050607; }
.lp-snapwrap::-webkit-scrollbar { display:none; }
.lp-snap { scroll-snap-align:start; scroll-snap-stop:always; position:relative; height:100vh; overflow:hidden; }

/* 네비 */
.lp-nav { position:fixed; top:0; left:0; right:0; width:100%; z-index:80; display:flex; align-items:center; justify-content:space-between;
  padding:18px 36px; background:rgba(5,6,7,0.6); backdrop-filter:blur(16px) saturate(140%); border-bottom:1px solid rgba(255,255,255,0.06); }
.lp-brand { display:flex; align-items:center; gap:10px; font-weight:700; font-size:15px; letter-spacing:-0.01em; }
.lp-brand.small { font-size:13px; opacity:0.75; }
.lp-navlinks { display:flex; align-items:center; gap:30px; font-size:13.5px; color:rgba(255,255,255,0.55); font-weight:500; }
.lp-navlinks a, .lp-navlink-btn { transition:color .2s ease; }
.lp-navlinks a:hover, .lp-navlink-btn:hover { color:#fff; }
.lp-login-btn { border:1px solid rgba(255,255,255,0.14); color:#fff !important; padding:9px 22px; border-radius:999px;
  font-weight:600; font-size:13px; transition:all .25s ease; }
.lp-login-btn:hover { border-color:var(--acc); background:rgba(77,182,172,0.1); box-shadow:0 0 20px rgba(77,182,172,0.18); }

/* 통합 글래스 CTA 버튼(양 화면 공용) */
.lp-glass-btn { display:inline-flex; align-items:center; gap:12px; padding:16px 28px; border-radius:999px;
  border:1px solid rgba(255,255,255,0.14); background:rgba(255,255,255,0.03); backdrop-filter:blur(14px);
  font-size:14.5px; font-weight:600; letter-spacing:-0.01em; color:#fff; transition:all .3s cubic-bezier(0.16,1,0.3,1); width:fit-content; }
.lp-glass-btn svg { width:16px; height:16px; stroke:var(--acc); stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; fill:none;
  transition:transform .3s cubic-bezier(0.16,1,0.3,1); }
.lp-glass-btn:hover { border-color:rgba(77,182,172,0.55); background:rgba(77,182,172,0.08); box-shadow:0 8px 32px rgba(77,182,172,0.16); transform:translateY(-2px); }
.lp-glass-btn:hover svg { transform:translateX(3px); }

.lp-btn-primary { display:inline-block; background:var(--acc); color:#050607; font-weight:700; font-size:14.5px;
  padding:16px 36px; border-radius:999px; transition:all .25s ease; letter-spacing:-0.01em; }
.lp-btn-primary:hover { box-shadow:0 10px 32px rgba(77,182,172,0.32); transform:translateY(-2px); }

/* 화면 1: 노드 (앞면) */
.lp-hero-glow { position:absolute; top:0; left:12%; width:760px; height:560px;
  background:radial-gradient(circle, rgba(77,182,172,0.09) 0%, transparent 68%); filter:blur(60px); pointer-events:none; }
.lp-hero-grid { position:relative; height:100%; max-width:1440px; margin:0 auto; width:100%; display:grid;
  grid-template-columns:1fr 1.15fr; gap:64px; align-items:center; padding:0 56px; }
.lp-hero-text { display:flex; flex-direction:column; justify-content:center; z-index:10; }
.lp-h1 { font-size:66px; line-height:1.08; font-weight:200; letter-spacing:-0.035em; margin-bottom:26px; color:#fff; }
.lp-subhead { font-size:17px; line-height:1.7; color:rgba(255,255,255,0.48); font-weight:400; max-width:440px; margin-bottom:42px; }
.lp-cta-group { display:flex; align-items:center; gap:20px; }

.lp-scrollcue { position:absolute; bottom:34px; left:50%; transform:translateX(-50%); z-index:20;
  display:flex; flex-direction:column; align-items:center; gap:8px;
  font-family:var(--font-mono); font-size:10px; letter-spacing:0.3em; color:rgba(255,255,255,0.4);
  animation:lp-bob 2.2s ease-in-out infinite; transition:opacity 400ms ease; opacity:1; }
.lp-scrollcue svg { width:14px; height:14px; stroke:rgba(255,255,255,0.4); stroke-width:1.6; fill:none; }
@keyframes lp-bob { 0%,100% { transform:translateX(-50%) translateY(0); } 50% { transform:translateX(-50%) translateY(7px); } }

.lp-canvas { position:relative; display:flex; align-items:center; justify-content:center; perspective:1200px; height:100%; }
.lp-backdrop { position:absolute; inset:40px -20px -20px 20px; border-radius:48px; background:linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(0,0,0,0.2) 100%);
  border-top:1px solid rgba(255,255,255,0.05); border-left:1px solid rgba(255,255,255,0.05); backdrop-filter:blur(40px);
  transform:rotateY(-15deg) rotateX(5deg) translateZ(-100px); transform-style:preserve-3d; pointer-events:none; }
.lp-scene { position:relative; width:100%; height:520px; transform-style:preserve-3d; transform:rotateY(-15deg) rotateX(5deg); }
.lp-splines { position:absolute; inset:0; width:100%; height:100%; z-index:1; }
.lp-spline-path { fill:none; stroke:rgba(77,182,172,0.16); stroke-width:1.4; stroke-dasharray:6 6; animation:lp-flow 22s linear infinite; }
.lp-spline-glow { fill:none; stroke:rgba(255,255,255,0.04); stroke-width:8; filter:blur(4px); }
@keyframes lp-flow { to { stroke-dashoffset:-100; } }
.lp-node { position:absolute; width:196px; height:116px; padding:13px; z-index:2; background:rgba(255,255,255,0.025);
  backdrop-filter:blur(18px) saturate(160%); border:1px solid rgba(255,255,255,0.07); border-top:1px solid rgba(255,255,255,0.13);
  border-radius:18px; box-shadow:0 26px 50px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08);
  display:flex; flex-direction:column; justify-content:space-between; transition:border-color .4s ease; }
.lp-node:hover { border-color:rgba(77,182,172,0.5); }
.lp-card-head { display:flex; align-items:center; gap:8px; }
.lp-avatar { width:19px; height:19px; border-radius:50%; background:rgba(255,255,255,0.09); }
.lp-card-title { height:4px; width:60%; background:rgba(255,255,255,0.18); border-radius:2px; }
.lp-card-meta { height:4px; width:40%; background:rgba(255,255,255,0.09); border-radius:2px; margin-top:6px; }
.lp-play { align-self:flex-end; width:23px; height:23px; border-radius:50%; background:rgba(255,255,255,0.09); display:flex; align-items:center; justify-content:center; }
.lp-play::after { content:''; width:0; height:0; border-style:solid; border-width:4px 0 4px 6px; border-color:transparent transparent transparent #fff; margin-left:2px; }
.lp-node-1 { top:9%; left:5%; --tz:30px; animation:lp-float 6s ease-in-out infinite; }
.lp-node-2 { top:60%; left:1%; --tz:10px; animation:lp-float 8s ease-in-out infinite 1s; }
.lp-node-3 { top:11%; right:7%; --tz:40px; animation:lp-float 7s ease-in-out infinite 2s; }
.lp-node-4 { top:65%; right:3%; --tz:20px; animation:lp-float 9s ease-in-out infinite .5s; }
@keyframes lp-float { 0%,100% { transform:translateY(0) translateZ(var(--tz,20px)); } 50% { transform:translateY(-12px) translateZ(var(--tz,20px)); } }
.lp-insight { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) translateZ(80px); width:138px; height:138px; border-radius:50%;
  background:rgba(255,255,255,0.025); border:1px solid rgba(255,255,255,0.09); box-shadow:0 34px 68px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.08);
  display:flex; align-items:center; justify-content:center; z-index:10; }
.lp-core { width:78px; height:78px; border-radius:50%; position:relative; display:flex; align-items:center; justify-content:center;
  background:radial-gradient(circle at 30% 30%, #f2f2f2 0%, #d1d3d6 60%, #9fa2a5 100%);
  box-shadow:-4px -4px 12px rgba(255,255,255,0.05), 8px 8px 24px rgba(0,0,0,0.3), inset -2px -2px 6px rgba(0,0,0,0.2), inset 2px 2px 6px rgba(255,255,255,0.9); }
.lp-core::before { content:''; position:absolute; inset:-12px; border-radius:50%; border:1px solid rgba(77,182,172,0.35); animation:lp-pulse 4s cubic-bezier(0.4,0,0.6,1) infinite; }
.lp-core::after { content:''; position:absolute; inset:-12px; border-radius:50%; border:1px solid rgba(77,182,172,0.18); animation:lp-pulse 4s cubic-bezier(0.4,0,0.6,1) infinite 2s; }
@keyframes lp-pulse { 0% { transform:scale(1); opacity:1; } 100% { transform:scale(1.6); opacity:0; } }
.lp-meta-lbl { position:absolute; font-size:10px; font-family:var(--font-mono); color:rgba(255,255,255,0.35); letter-spacing:0.1em; pointer-events:none; }
.lp-lbl-1 { bottom:-20px; left:50%; transform:translateX(-50%); }
.lp-lbl-2 { top:-26px; left:50%; transform:translateX(-50%); }

/* 화면 2: 나비 (뒷면) */
.bfy-dot { position:absolute; inset:0; z-index:1; pointer-events:none; opacity:0.55;
  background-image:radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1px); background-size:42px 42px; }
.bfy-canvas { position:absolute; inset:0; z-index:2; }
.bfy-overlay { position:relative; z-index:10; height:100%; display:flex; flex-direction:column; padding:100px 64px 56px; pointer-events:none; }
.bfy-overlay > * { pointer-events:auto; }
.bfy-hero { max-width:720px; }
.bfy-h1 { font-size:60px; font-weight:200; line-height:1.15; letter-spacing:-0.03em; margin-bottom:38px; color:#fff; }
.bfy-actions { display:flex; align-items:center; gap:32px; flex-wrap:wrap; }
.bfy-stat { display:flex; flex-direction:column; gap:4px; }
.bfy-stat .v { font-family:var(--font-mono); font-size:14px; color:var(--acc); }
.bfy-stat .l { font-size:9px; text-transform:uppercase; letter-spacing:0.1em; color:rgba(255,255,255,0.38); }
.bfy-floating { position:absolute; right:64px; top:38%; display:flex; flex-direction:column; gap:48px; text-align:right; }
.bfy-fstat .v { font-family:var(--font-mono); font-size:32px; font-weight:500; display:block; letter-spacing:-0.01em; color:#fff; }
.bfy-fstat .l { font-family:var(--font-mono); font-size:10px; text-transform:uppercase; color:rgba(255,255,255,0.38); letter-spacing:0.1em; }
.bfy-features { display:grid; grid-template-columns:repeat(3,1fr); gap:1px; background:rgba(255,255,255,0.07); margin-top:auto; border:1px solid rgba(255,255,255,0.07); border-radius:16px; overflow:hidden; }
.bfy-fcard { background:rgba(5,6,7,0.7); backdrop-filter:blur(8px); padding:30px 32px; transition:background .3s; }
.bfy-fcard:hover { background:rgba(15,17,20,0.85); }
.bfy-fcard .num { font-family:var(--font-mono); font-size:11px; color:rgba(255,255,255,0.32); margin-bottom:20px; display:block; letter-spacing:0.08em; }
.bfy-fcard .num em { color:var(--acc); font-style:normal; }
.bfy-fcard h3 { font-size:19px; font-weight:600; margin-bottom:10px; letter-spacing:-0.01em; }
.bfy-fcard p { font-size:13px; color:rgba(255,255,255,0.4); line-height:1.65; max-width:280px; }

/* 콘텐츠 */
.lp-section { max-width:1080px; margin:0 auto; padding:100px 32px; }
.lp-h2 { font-size:36px; font-weight:200; letter-spacing:-0.02em; margin:12px 0 22px; color:#fff; }
.lp-lead { font-size:16px; color:rgba(255,255,255,0.5); line-height:1.85; max-width:700px; font-weight:400; }
.lp-steps { display:grid; grid-template-columns:repeat(4,1fr); gap:20px; margin-top:30px; }
.lp-step { border-left:1px solid rgba(77,182,172,0.35); padding:8px 0 8px 20px; }
.lp-step-n { font-family:var(--font-mono); font-size:20px; font-weight:600; color:var(--acc); }
.lp-step h4 { font-size:15.5px; font-weight:600; margin:10px 0 6px; letter-spacing:-0.01em; }
.lp-step p { font-size:13px; color:rgba(255,255,255,0.42); line-height:1.65; }
.lp-cta { text-align:center; padding:110px 32px; max-width:1080px; margin:0 auto;
  border-top:1px solid rgba(255,255,255,0.07); border-bottom:1px solid rgba(255,255,255,0.07);
  background:linear-gradient(180deg, rgba(77,182,172,0.05), transparent); }
.lp-cta h2 { font-size:34px; font-weight:200; letter-spacing:-0.02em; color:#fff; }
.lp-cta p { color:rgba(255,255,255,0.48); margin:14px 0 30px; font-size:15px; }
.lp-footer { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:14px; max-width:1080px; margin:0 auto; padding:32px 32px 56px; }
.lp-foot-meta { display:flex; flex-direction:column; gap:4px; font-size:12px; color:rgba(255,255,255,0.32); text-align:right; }

/* 반응형 */
@media (max-width:1100px) {
  .bfy-floating { display:none; }
}
@media (max-width:1024px) {
  .lp-hero-grid { grid-template-columns:1fr; gap:18px; padding:0 24px; }
  .lp-hero-text { justify-content:flex-start; padding-top:64px; }
  .lp-canvas { perspective:none; height:auto; flex:1; min-height:0; }
  .lp-scene { transform:none; height:100%; }
  .lp-backdrop { transform:none; inset:20px 0 0 0; }
  .lp-node { --tz:0px !important; } .lp-insight { transform:translate(-50%,-50%); }
  .lp-h1 { font-size:38px; margin-bottom:14px; }
  .lp-subhead { margin-bottom:22px; }
  .bfy-overlay { padding:84px 28px 24px; }
  .bfy-h1 { font-size:34px; margin-bottom:24px; }
}
@media (max-width:768px) {
  .lp-nav { padding:14px 20px; } .lp-navlinks { gap:14px; font-size:12.5px; }
  .lp-navlinks a:not(.lp-login-btn) { display:none; }
  .lp-navlink-btn { display:none; }
  .lp-h1 { font-size:30px; } .lp-subhead { font-size:14px; }
  .lp-node { width:130px; height:84px; padding:10px; }
  .lp-scrollcue { bottom:18px; }
  .bfy-h1 { font-size:28px; } .bfy-features { grid-template-columns:1fr; }
  .bfy-actions { gap:20px; }
  .lp-section { padding:64px 20px; } .lp-h2 { font-size:26px; } .lp-steps { grid-template-columns:1fr; }
  .lp-footer { flex-direction:column; align-items:flex-start; } .lp-foot-meta { text-align:left; }
}
`
