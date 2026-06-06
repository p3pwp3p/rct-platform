'use client'
import { useEffect, useRef } from 'react'

interface Node {
  x: number
  y: number
  label: string
  active: boolean
}

interface Packet {
  from: number
  to: number
  progress: number
  speed: number
}

export default function NetworkCanvas({ dim = false }: { dim?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animFrameId: number

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const W = () => canvas.width
    const H = () => canvas.height

    // Build binary tree node positions
    const buildNodes = (): Node[] => {
      const w = W()
      const h = H()
      const nodes: Node[] = []
      const levels = 4
      const labels = ['ROOT', 'L-ALPHA', 'R-BETA', 'L-01', 'L-02', 'R-03', 'R-04', 'N-A', 'N-B', 'N-C', 'N-D', 'N-E', 'N-F', 'N-G', 'N-H']
      let idx = 0
      for (let lv = 0; lv < levels; lv++) {
        const count = Math.pow(2, lv)
        const yPos = 80 + lv * (h - 120) / (levels - 1)
        for (let i = 0; i < count; i++) {
          const xPos = (w / (count + 1)) * (i + 1)
          nodes.push({
            x: xPos,
            y: yPos,
            label: labels[idx] ?? `N-${idx}`,
            active: Math.random() > 0.3,
          })
          idx++
        }
      }
      return nodes
    }

    // Connections: each parent connects to 2 children
    const buildEdges = (nodes: Node[]) => {
      const edges: [number, number][] = []
      let idx = 0
      let levelStart = 0
      for (let lv = 0; lv < 3; lv++) {
        const count = Math.pow(2, lv)
        const nextStart = levelStart + count
        for (let i = 0; i < count; i++) {
          edges.push([levelStart + i, nextStart + i * 2])
          edges.push([levelStart + i, nextStart + i * 2 + 1])
        }
        levelStart += count
        idx++
      }
      return edges
    }

    let nodes = buildNodes()
    let edges = buildEdges(nodes)
    let packets: Packet[] = []

    // Seed some packets
    for (let i = 0; i < 6; i++) {
      const e = edges[Math.floor(Math.random() * edges.length)]
      packets.push({ from: e[0], to: e[1], progress: Math.random(), speed: 0.003 + Math.random() * 0.004 })
    }

    const draw = () => {
      ctx.clearRect(0, 0, W(), H())

      // Draw edges
      for (const [a, b] of edges) {
        if (!nodes[a] || !nodes[b]) continue
        ctx.beginPath()
        ctx.moveTo(nodes[a].x, nodes[a].y)
        ctx.lineTo(nodes[b].x, nodes[b].y)
        ctx.strokeStyle = dim ? 'rgba(36,42,53,0.6)' : 'rgba(36,42,53,0.9)'
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Draw packets
      for (const pkt of packets) {
        const a = nodes[pkt.from]
        const b = nodes[pkt.to]
        if (!a || !b) continue
        const px = a.x + (b.x - a.x) * pkt.progress
        const py = a.y + (b.y - a.y) * pkt.progress
        ctx.beginPath()
        ctx.arc(px, py, 3, 0, Math.PI * 2)
        ctx.fillStyle = dim ? 'rgba(77,182,172,0.3)' : '#4db6ac'
        ctx.fill()
        if (!dim) {
          ctx.beginPath()
          ctx.arc(px, py, 6, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(77,182,172,0.15)'
          ctx.fill()
        }
        pkt.progress += pkt.speed
        if (pkt.progress >= 1) {
          pkt.progress = 0
          const e = edges[Math.floor(Math.random() * edges.length)]
          pkt.from = e[0]
          pkt.to = e[1]
        }
      }

      // Draw nodes
      for (const node of nodes) {
        const r = 8
        ctx.beginPath()
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
        ctx.fillStyle = dim ? 'var(--bg-inset)' : 'var(--bg-surface)'
        ctx.fill()
        ctx.strokeStyle = dim
          ? 'rgba(36,42,53,0.5)'
          : node.active
          ? 'rgba(77,182,172,0.8)'
          : 'rgba(50,58,72,0.9)'
        ctx.lineWidth = 1.5
        ctx.stroke()

        if (!dim && node.active) {
          ctx.beginPath()
          ctx.arc(node.x, node.y, r + 4, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(77,182,172,0.2)'
          ctx.lineWidth = 1
          ctx.stroke()
        }

        ctx.font = '9px JetBrains Mono, monospace'
        ctx.fillStyle = dim ? 'rgba(100,116,139,0.4)' : node.active ? '#4db6ac' : '#64748b'
        ctx.textAlign = 'center'
        ctx.fillText(node.label, node.x, node.y + r + 12)
      }

      animFrameId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animFrameId)
      window.removeEventListener('resize', resize)
    }
  }, [dim])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: 'block' }}
    />
  )
}
