'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * Kinetic butterfly — 12,000 파티클이 나비 궤적을 그리는 Three.js 애니메이션.
 * 원본(Butterfly.fi)을 우리 브랜드 색(틸)으로 변경.
 *
 * `active` 가 true 가 되는 순간(페이지 플립 진행률 기준 등 부모가 결정) 시작 + 페이드인.
 * 지오메트리 기반 IntersectionObserver 대신 명시적 prop 으로 제어(부모가 이미
 * 겹쳐진 레이어 안에 항상 렌더하므로 화면 교차만으로는 트리거 시점을 알 수 없음).
 */
export default function ButterflyCanvas({ color = 0x4db6ac, active = true }: { color?: number; active?: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const startRef = useRef<() => void>(() => {})

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let w = mount.clientWidth || 600
    let h = mount.clientHeight || 520

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000)
    camera.position.z = 5

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    const count = 12000
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 10
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10
      pos[i * 3 + 2] = (Math.random() - 0.5) * 5
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))

    const mat = new THREE.PointsMaterial({
      color, size: 0.015, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false,
    })
    const points = new THREE.Points(geo, mat)
    scene.add(points)

    const butterfly = (t: number) => {
      const scale = 0.8
      const f = Math.exp(Math.cos(t)) - 2 * Math.cos(4 * t) - Math.pow(Math.sin(t / 12), 5)
      return { x: Math.sin(t) * f * scale, y: Math.cos(t) * f * scale }
    }

    const arr = geo.attributes.position.array as Float32Array
    let time = 0
    let raf = 0
    let started = false
    const animate = () => {
      raf = requestAnimationFrame(animate)
      time += 0.01
      for (let i = 0; i < count; i++) {
        const i3 = i * 3
        const t = (i / count) * Math.PI * 12 + time * 0.2
        const tg = butterfly(t)
        const flutter = Math.sin(time * 2 + i * 0.01) * 0.2
        arr[i3] += (tg.x - arr[i3]) * 0.02
        arr[i3 + 1] += (tg.y - arr[i3 + 1]) * 0.02
        arr[i3 + 2] += (flutter - arr[i3 + 2]) * 0.01
      }
      geo.attributes.position.needsUpdate = true
      points.rotation.y = Math.sin(time * 0.5) * 0.15
      points.rotation.z = Math.cos(time * 0.3) * 0.05
      camera.position.x = Math.sin(time * 0.2) * 0.5
      camera.position.y = Math.cos(time * 0.2) * 0.5
      camera.lookAt(0, 0, 0)
      renderer.render(scene, camera)
    }

    // 시작 전엔 숨김(무작위 시작점이 흩뿌려진 정적 프레임 노출 방지).
    mount.style.opacity = '0'
    mount.style.transition = 'opacity 1.2s ease'
    startRef.current = () => {
      if (started) return
      started = true
      mount.style.opacity = '1'
      animate()
    }
    if (active) startRef.current()

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
      geo.dispose(); mat.dispose(); renderer.dispose()
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color])

  // active 가 나중에 true 로 바뀌는 경우(스크롤 진행률 기준) 시작 트리거
  useEffect(() => {
    if (active) startRef.current()
  }, [active])

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}
