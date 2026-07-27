'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * 이용방법 섹션용 — 층층이 쌓이는 와이어프레임 구조 애니메이션(자동 거래 파이프라인 은유).
 * `active` 가 true 일 때만 조립(아래→위로 레이어가 순차 등장 + 은은한 회전), false 면 정지.
 */
export default function WireframeStructureScene({ color = 0x4db6ac, active = false }: { color?: number; active?: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef(active)

  useEffect(() => { activeRef.current = active }, [active])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let w = mount.clientWidth || 480
    let h = mount.clientHeight || 480

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100)
    camera.position.set(6, 5, 8)
    camera.lookAt(0, 2, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    const group = new THREE.Group()
    scene.add(group)

    const dim = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.16 })
    const bright = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 })

    const layers = 9
    const lines: THREE.LineSegments[] = []
    for (let i = 0; i < layers; i++) {
      const shrink = 1 - (i / layers) * 0.35
      const geo = new THREE.BoxGeometry(3.2 * shrink, 0.5, 3.2 * shrink)
      const edges = new THREE.EdgesGeometry(geo)
      const seg = new THREE.LineSegments(edges, i % 3 === 0 ? bright : dim)
      seg.position.y = i * 0.62
      seg.scale.y = 0.001
      group.add(seg)
      lines.push(seg)
    }

    let raf = 0
    let t = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      t += 0.012
      const on = activeRef.current
      lines.forEach((seg, i) => {
        const target = on ? 1 : 0.001
        seg.scale.y += (target - seg.scale.y) * 0.06
      })
      group.rotation.y = on ? t * 0.25 : group.rotation.y
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
      lines.forEach((seg) => { seg.geometry.dispose() })
      dim.dispose(); bright.dispose(); renderer.dispose()
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color])

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}
