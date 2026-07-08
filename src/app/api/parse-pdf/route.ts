import { NextRequest, NextResponse } from 'next/server'
import { PDFParse } from 'pdf-parse'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, tooMany } from '@/lib/rate-limit'
import type { ParsedPdfReport } from '@/lib/types'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  // 인증된 사용자만 허용 (관리자 또는 일반 회원)
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const { data: { user } } = await adminClient.auth.getUser(token)
  if (!user) return NextResponse.json({ error: '인증 실패' }, { status: 401 })

  // PDF 파싱은 CPU 부하가 크므로 사용자당 분당 20회로 제한
  if (!await rateLimit(`parse-pdf:${user.id}`, 20, 60)) return NextResponse.json(tooMany, { status: 429 })

  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    // 크기·형식 제한 (메모리 고갈 방지) — 정산 보고서 PDF는 수 MB 이내
    const MAX_BYTES = 10 * 1024 * 1024
    if (file.size > MAX_BYTES) return NextResponse.json({ error: '파일이 너무 큽니다 (최대 10MB)' }, { status: 413 })
    if (file.type && file.type !== 'application/pdf') return NextResponse.json({ error: 'PDF 파일만 업로드 가능합니다.' }, { status: 415 })

    const buf = Buffer.from(await file.arrayBuffer())
    const parser = new PDFParse({ data: new Uint8Array(buf), verbosity: 0 })
    // getText()가 내부적으로 문서를 로드하므로 별도 load() 호출 불필요
    const { text } = await parser.getText()

    const result = parsePdfText(text)
    if (!result) return NextResponse.json({ error: '파싱 실패: 지원하지 않는 PDF 형식' }, { status: 422 })

    return NextResponse.json(result)
  } catch (e: any) {
    console.error('[parse-pdf]', e)
    return NextResponse.json({ error: e.message ?? '파싱 오류' }, { status: 500 })
  }
}

// ── PDF 텍스트 파서 ─────────────────────────────────────────────────────────
function parsePdfText(text: string): ParsedPdfReport | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // 1. 계정 ID 추출: "계정" 다음 줄의 순수 숫자
  let mt5AccountId = ''
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '계정' || lines[i].startsWith('계정')) {
      // 다음 줄에서 숫자만 추출
      const next = lines[i + 1] ?? ''
      const m = next.match(/(\d{6,12})/)
      if (m) { mt5AccountId = m[1]; break }
    }
    // 줄 안에 "계정" + 숫자가 같이 있는 경우
    const inline = lines[i].match(/계정[\s:]*(\d{6,12})/)
    if (inline) { mt5AccountId = inline[1]; break }
  }
  if (!mt5AccountId) return null

  // 2. 테이블 행 파싱
  // 패턴: [전략명] [주/월] [DD/MM/YYYY-DD/MM/YYYY] [숫자] [숫자%] [숫자]
  const datePattern = /(\d{2}\/\d{2}\/\d{4})-(\d{2}\/\d{2}\/\d{4})/
  const rowPattern = /^(.+?)\s+(주|월|분기)\s+(\d{2}\/\d{2}\/\d{4}-\d{2}\/\d{2}\/\d{4})\s+([\d.]+)\s+([\d.]+)%\s+([\d.]+)$/

  const items: ParsedPdfReport['items'] = []

  for (const line of lines) {
    const m = line.match(rowPattern)
    if (!m) continue

    const [, strategyName, , dateRange, income, ratio, unpaid] = m
    const dm = dateRange.match(datePattern)!
    items.push({
      strategyName:      strategyName.trim(),
      dateFrom:          dmyToIso(dm[1]),
      dateTo:            dmyToIso(dm[2]),
      distributedIncome: parseFloat(income),
      profitRatio:       parseFloat(ratio) / 100,
      unpaidProfit:      parseFloat(unpaid),
    })
  }

  if (!items.length) return null

  const totalUnpaid = items.reduce((s, i) => s + i.unpaidProfit, 0)

  // 전체 날짜 범위: items 중 가장 넓은 범위
  const dateFrom = items.map(i => i.dateFrom).sort()[0]
  const dateTo   = items.map(i => i.dateTo).sort().reverse()[0]

  return { mt5AccountId, dateFrom, dateTo, items, totalUnpaid }
}

// DD/MM/YYYY → YYYY-MM-DD
function dmyToIso(dmy: string): string {
  const [d, m, y] = dmy.split('/')
  return `${y}-${m}-${d}`
}
