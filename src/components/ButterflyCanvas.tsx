'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * Kinetic butterfly — 12,000 파티클이 나비 궤적을 그리는 Three.js 애니메이션.
 * 원본(Butterfly.fi)을 우리 브랜드 색(틸)으로 변경.
 *
 * `active` 가 true 면 흩어진 입자가 나비 모양으로 "조립", false 가 되면 그 반대로
 * "분해"(원래 흩어진 위치로 되돌아감) — 섹션에 들어올 때마다/나갈 때마다 반복 재생됨.
 */
export default function ButterflyCanvas({ color = 0x4db6ac, active = true }: { color?: number; active?: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const assembleRef = useRef(active)

  useEffect(() => { assembleRef.current = active }, [active])

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
    // 흩어진(분해) 상태의 기준 좌표 — "나갈 때" 되돌아갈 목표점으로 재사용
    const scatterX = new Float32Array(count)
    const scatterY = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const sx = (Math.random() - 0.5) * 10
      const sy = (Math.random() - 0.5) * 10
      scatterX[i] = sx; scatterY[i] = sy
      pos[i * 3] = sx
      pos[i * 3 + 1] = sy
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
    let everShown = false
    const animate = () => {
      raf = requestAnimationFrame(animate)
      time += 0.01
      const assembling = assembleRef.current
      for (let i = 0; i < count; i++) {
        const i3 = i * 3
        let tx: number, ty: number
        if (assembling) {
          const t = (i / count) * Math.PI * 12 + time * 0.2
          const tg = butterfly(t)
          tx = tg.x; ty = tg.y
        } else {
          tx = scatterX[i]; ty = scatterY[i]
        }
        const flutter = Math.sin(time * 2 + i * 0.01) * 0.2
        arr[i3] += (tx - arr[i3]) * 0.02
        arr[i3 + 1] += (ty - arr[i3 + 1]) * 0.02
        arr[i3 + 2] += (flutter - arr[i3 + 2]) * 0.01
      }
      geo.attributes.position.needsUpdate = true
      points.rotation.y = Math.sin(time * 0.5) * 0.15
      points.rotation.z = Math.cos(time * 0.3) * 0.05
      camera.position.x = Math.sin(time * 0.2) * 0.5
      camera.position.y = Math.cos(time * 0.2) * 0.5
      camera.lookAt(0, 0, 0)
      renderer.render(scene, camera)

      // 최초 진입 시 한 번만 페이드인(이후엔 계속 보이는 채로 조립/분해 반복)
      if (assembling && !everShown) {
        everShown = true
        mount.style.opacity = '1'
      }
    }

    mount.style.opacity = '0'
    mount.style.transition = 'opacity 1s ease'
    renderer.render(scene, camera)
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
      geo.dispose(); mat.dispose(); renderer.dispose()
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color])

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}
