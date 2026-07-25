/**
 * 월간 ProfitShareReview CSV 파서 + PF/N 분배 유틸.
 *
 * PF = sharedProfit (HWM 적용, 손실월 자동 0). 회원별로 노드 수 N 에 균등 분배하되
 * 센트 단위로 정확히 합이 맞도록 나머지를 마지막 노드가 흡수한다.
 */

export type ProfitCsvRow = {
  vantageCt: string          // followerMasterAccountNo
  followerName: string
  netProfit: number
  sharedProfit: number       // = PF
  profitSharePercentage: number
  period: string             // lastSettlementPeriod 원문
}

// 최소 CSV 파서 (따옴표 필드 대응)
function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else inQ = false
      } else cur += c
    } else {
      if (c === '"') inQ = true
      else if (c === ',') { out.push(cur); cur = '' }
      else cur += c
    }
  }
  out.push(cur)
  return out
}

export function parseProfitShareCsv(text: string): ProfitCsvRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length < 2) return []
  const header = parseCsvLine(lines[0])
  const idx = (name: string) => header.indexOf(name)
  const iCt = idx('followerMasterAccountNo')
  const iName = idx('followerName')
  const iNet = idx('netProfit')
  const iShared = idx('sharedProfit')
  const iPct = idx('profitSharePercentage')
  const iPeriod = idx('lastSettlementPeriod')
  if (iCt < 0 || iShared < 0) return []   // 필수 컬럼 없음

  const rows: ProfitCsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const c = parseCsvLine(lines[i])
    const ct = (c[iCt] ?? '').trim()
    if (!ct) continue
    rows.push({
      vantageCt: ct,
      followerName: (c[iName] ?? '').trim(),
      netProfit: parseFloat(c[iNet] ?? '0') || 0,
      sharedProfit: parseFloat(c[iShared] ?? '0') || 0,
      profitSharePercentage: parseFloat(c[iPct] ?? '0') || 0,
      period: (c[iPeriod] ?? '').trim(),
    })
  }
  return rows
}

/** 계정별 합산(같은 CT 여러 행이면 합침). */
export function aggregateByCt(rows: ProfitCsvRow[]): Map<string, { sharedProfit: number; netProfit: number; pct: number; name: string; period: string }> {
  const m = new Map<string, { sharedProfit: number; netProfit: number; pct: number; name: string; period: string }>()
  for (const r of rows) {
    const cur = m.get(r.vantageCt) ?? { sharedProfit: 0, netProfit: 0, pct: r.profitSharePercentage, name: r.followerName, period: r.period }
    cur.sharedProfit += r.sharedProfit
    cur.netProfit += r.netProfit
    m.set(r.vantageCt, cur)
  }
  return m
}

/**
 * total 을 n 등분하되 센트 단위로 합이 정확히 맞게 분배(나머지는 마지막이 흡수).
 * 예: splitEven(122.71, 3) → [40.90, 40.90, 40.91]
 */
export function splitEven(total: number, n: number): number[] {
  if (n <= 0) return []
  const totalCents = Math.round(total * 100)
  const base = Math.floor(totalCents / n)
  const rem = totalCents - base * n            // 0..n-1
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const cents = base + (i >= n - rem ? 1 : 0) // 뒤쪽 노드들이 1센트씩 더
    out.push(cents / 100)
  }
  return out
}

/** 기간 문자열 "2026-06-01 - 2026-06-30" → { from, to } */
export function parsePeriod(period: string): { from: string; to: string } | null {
  const m = period.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/)
  return m ? { from: m[1], to: m[2] } : null
}
