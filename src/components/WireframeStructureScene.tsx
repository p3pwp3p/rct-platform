'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * 이용방법 섹션용 — 층층이 쌓이는 와이어프레임 타워(자동 거래 파이프라인 은유).
 * 카드/박스 없이 화면에 그대로 세워지는 full-bleed 비주얼.
 *
 *  - `active`   : 섹션에 들어와 있는 동안 층이 아래→위로 순차 조립, 벗어나면 되감김
 *  - `progress` : 섹션 스크롤 진행도(0~1). 카메라 높이/시선이 따라 올라가며 타워를 훑음
 */
export default function WireframeStructureScene({
  color = 0x4db6ac,
  active = false,
  progress = 0,
}: { color?: number; active?: boolean; progress?: number }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef(active)
  const progressRef = useRef(progress)

  useEffect(() => { activeRef.current = active }, [active])
  useEffect(() => { progressRef.current = progress }, [progress])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let w = mount.clientWidth || 480
    let h = mount.clientHeight || 800

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 300)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    const group = new THREE.Group()
    scene.add(group)

    // 아래는 넓고 위로 갈수록 좁아지는 테이퍼 타워
    const FLOORS = 44
    const FLOOR_H = 0.62
    const TOP = FLOORS * FLOOR_H

    const dim = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.14 })
    const bright = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 })
    const coreMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.1 })

    const floors: THREE.LineSegments[] = []
    for (let i = 0; i < FLOORS; i++) {
      const shrink = 1 - (i / FLOORS) * 0.55
      const geo = new THREE.BoxGeometry(5.2 * shrink, FLOOR_H, 5.2 * shrink)
      const seg = new THREE.LineSegments(new THREE.EdgesGeometry(geo), i % 5 === 0 ? bright : dim)
      geo.dispose()
      seg.position.y = i * FLOOR_H
      seg.scale.set(0.001, 0.001, 0.001)
      group.add(seg)
      floors.push(seg)

      // 중앙 코어
      const cgeo = new THREE.BoxGeometry(1.1, FLOOR_H, 1.1)
      const core = new THREE.LineSegments(new THREE.EdgesGeometry(cgeo), coreMat)
      cgeo.dispose()
      core.position.y = i * FLOOR_H
      core.scale.set(0.001, 0.001, 0.001)
      group.add(core)
      floors.push(core)
    }

    // 타워 중심을 원점 부근으로
    group.position.y = -TOP / 2

    let raf = 0
    let t = 0
    let spin = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      t += 0.016
      const on = activeRef.current
      const p = progressRef.current

      // 층별 순차 조립 — 아래층부터 차례로 (분해는 그 역순)
      const pairs = FLOORS
      for (let i = 0; i < pairs; i++) {
        const delay = i / pairs
        const gate = on ? Math.min(1, Math.max(0, (t * 0.32) - delay * 1.1)) : 0
        const target = gate
        const a = floors[i * 2], b = floors[i * 2 + 1]
        const s = a.scale.x + (target - a.scale.x) * 0.08
        a.scale.set(s, s, s)
        b.scale.set(s, s, s)
      }
      if (!on) t = 0

      spin += 0.0018
      group.rotation.y = spin

      // 스크롤 진행에 따라 카메라가 타워를 아래에서 위로 훑고 지나감
      // 세로로 긴 화면이면 카메라를 조금 더 당겨 타워 전체가 들어오도록 보정
      const fit = Math.max(1, 1.15 * (h / Math.max(w, 1)) * 0.9)
      const camY = -TOP * 0.18 + p * TOP * 0.5
      camera.position.set(22 * fit, camY, 30 * fit)
      camera.lookAt(0, camY * 0.5, 0)

      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      const nw = mount.clientWidth, nh = mount.clientHeight
      if (!nw || !nh || (nw === w && nh === h)) return
      w = nw; h = nh
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)
    const ro = new ResizeObserver(onResize)
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      ro.disconnect()
      floors.forEach((s) => s.geometry.dispose())
      dim.dispose(); bright.dispose(); coreMat.dispose(); renderer.dispose()
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color])

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}
