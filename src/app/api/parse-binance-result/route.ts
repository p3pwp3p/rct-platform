import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export interface BinanceResultRow {
  address: string
  amount: number
  currency: string
  status: 'success' | 'failed'
  remark: string
  reason: string   // failure reason, empty if success
}

export async function POST(req: NextRequest) {
  // 관리자만 허용
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const { data: { user } } = await adminClient.auth.getUser(token)
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
  }

  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const text = await file.text()
    const rows = parseBinanceCsv(text)

    return NextResponse.json({ rows })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? '파싱 오류' }, { status: 500 })
  }
}

// ── Binance 일괄전송 결과 CSV 파서 ────────────────────────────────────────────
// Binance 결과 CSV 헤더 예시:
// No.,Address,Amount,Currency,Status,Remark,Reason
// 1,TRxxxxxx,125.50,USDT,Success,홍길동 14278827,...,
// 2,TRxxxxxx,80.00,USDT,Failed,이영희 14278828,...,Invalid address
function parseBinanceCsv(text: string): BinanceResultRow[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []

  // 헤더 행에서 컬럼 인덱스 찾기
  const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''))

  const idxAddress  = findCol(header, ['address', '주소'])
  const idxAmount   = findCol(header, ['amount', '금액'])
  const idxCurrency = findCol(header, ['currency', '통화'])
  const idxStatus   = findCol(header, ['status', '상태'])
  const idxRemark   = findCol(header, ['remark', '메모', 'note'])
  const idxReason   = findCol(header, ['reason', '실패사유', 'fail reason'])

  const results: BinanceResultRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i])
    if (cols.length < 3) continue

    const statusRaw = (cols[idxStatus] ?? '').toLowerCase()
    const status: 'success' | 'failed' =
      statusRaw.includes('success') || statusRaw.includes('완료') || statusRaw === '1'
        ? 'success'
        : 'failed'

    results.push({
      address:  cols[idxAddress]  ?? '',
      amount:   parseFloat(cols[idxAmount] ?? '0') || 0,
      currency: cols[idxCurrency] ?? 'USDT',
      status,
      remark:   cols[idxRemark]   ?? '',
      reason:   cols[idxReason]   ?? '',
    })
  }

  return results
}

function findCol(header: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = header.findIndex(h => h.includes(c))
    if (idx !== -1) return idx
  }
  // fallback: positional guess
  return candidates[0] === 'address' ? 1 : candidates[0] === 'amount' ? 2 : 0
}

// 쉼표 CSV 파서 (따옴표 내 쉼표 처리)
function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuote = false
  for (const ch of line) {
    if (ch === '"') { inQuote = !inQuote }
    else if (ch === ',' && !inQuote) { result.push(cur.trim()); cur = '' }
    else { cur += ch }
  }
  result.push(cur.trim())
  return result
}
