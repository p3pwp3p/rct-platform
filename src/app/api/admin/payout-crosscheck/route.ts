/**
 * POST /api/admin/payout-crosscheck
 *
 * 엑셀로 만든 정산 보고서를, 거래소가 준 PDF 원본과 대조한다.
 * (엑셀만으로도 정산은 되지만, 금액이 맞는지 PDF 로 교차검증하는 용도)
 *
 * body: { reportId: string, pdfs: ParsedPdfReport[] }
 *
 * 대조 기준: PDF 의 계정번호(mt5AccountId) ↔ 보고서 항목의 mt5_account_id
 *   (엑셀 임포트가 Vantage CT 번호를 그 필드에 넣는다)
 *   같은 계정의 보고서 항목이 여러 개(노드별 분배)면 합산해서 비교한다.
 *
 * 결과 구분
 *   match      : 금액 일치
 *   mismatch   : 금액 불일치 (차액 표시)
 *   pdf_only   : PDF 에는 있는데 보고서에 없음 (누락 의심)
 *   report_only: 보고서에는 있는데 PDF 를 안 올림 (미검증)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, clientIp, tooMany } from '@/lib/rate-limit'
import type { ParsedPdfReport } from '@/lib/types'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function adminUser(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  if (!token) return null
  const { data } = await admin.auth.getUser(token)
  return data.user?.app_metadata?.role === 'admin' ? data.user : null
}

/** 소수점 오차로 불일치가 나지 않도록 1센트 허용 */
const TOLERANCE = 0.01
const round2 = (n: number) => Math.round(n * 100) / 100

export async function POST(req: NextRequest) {
  try {
    if (!await adminUser(req)) {
      return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
    }
    if (!await rateLimit(`payout-crosscheck:${clientIp(req)}`, 20, 60)) {
      return NextResponse.json(tooMany, { status: 429 })
    }

    const { reportId, pdfs } = await req.json().catch(() => ({}))
    if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 })
    if (!Array.isArray(pdfs) || pdfs.length === 0) {
      return NextResponse.json({ error: 'PDF 를 한 개 이상 올려주세요.' }, { status: 400 })
    }

    const { data: report } = await admin
      .from('profit_reports')
      .select('id, date_from, date_to, status, total_unpaid')
      .eq('id', reportId)
      .maybeSingle()
    if (!report) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 })

    // 보고서 항목을 계정번호별로 합산
    const { data: items, error: itemErr } = await admin
      .from('profit_report_items')
      .select('mt5_account_id, unpaid_profit, matched_node_id, matched_name')
      .eq('report_id', reportId)
    if (itemErr) throw itemErr

    type Side = { amount: number; nodes: string[]; name: string }
    const byReport = new Map<string, Side>()
    for (const it of (items ?? [])) {
      const key = String(it.mt5_account_id ?? '').trim()
      if (!key) continue
      const cur = byReport.get(key) ?? { amount: 0, nodes: [], name: '' }
      cur.amount += Number(it.unpaid_profit) || 0
      if (it.matched_node_id) cur.nodes.push(it.matched_node_id)
      if (!cur.name && it.matched_name) cur.name = it.matched_name
      byReport.set(key, cur)
    }

    // PDF 도 계정번호별로 합산 (같은 계정 PDF 를 여러 장 올릴 수 있음)
    const byPdf = new Map<string, { amount: number; files: number; period: string }>()
    for (const p of pdfs as ParsedPdfReport[]) {
      const key = String(p?.mt5AccountId ?? '').trim()
      if (!key) continue
      const cur = byPdf.get(key) ?? { amount: 0, files: 0, period: '' }
      cur.amount += Number(p.totalUnpaid) || 0
      cur.files += 1
      if (!cur.period && p.dateFrom) cur.period = `${p.dateFrom} ~ ${p.dateTo}`
      byPdf.set(key, cur)
    }

    type Row = {
      account: string; name: string; nodes: string[]
      reportAmount: number | null; pdfAmount: number | null
      diff: number | null; status: 'match' | 'mismatch' | 'pdf_only' | 'report_only'
      pdfPeriod: string | null; pdfFiles: number
    }
    const rows: Row[] = []

    for (const [account, r] of byReport) {
      const p = byPdf.get(account)
      if (!p) {
        rows.push({
          account, name: r.name, nodes: r.nodes,
          reportAmount: round2(r.amount), pdfAmount: null, diff: null,
          status: 'report_only', pdfPeriod: null, pdfFiles: 0,
        })
        continue
      }
      const diff = round2(r.amount - p.amount)
      rows.push({
        account, name: r.name, nodes: r.nodes,
        reportAmount: round2(r.amount), pdfAmount: round2(p.amount), diff,
        status: Math.abs(diff) <= TOLERANCE ? 'match' : 'mismatch',
        pdfPeriod: p.period || null, pdfFiles: p.files,
      })
    }
    // PDF 에만 있는 계정 — 엑셀에서 빠졌을 가능성
    for (const [account, p] of byPdf) {
      if (byReport.has(account)) continue
      rows.push({
        account, name: '', nodes: [],
        reportAmount: null, pdfAmount: round2(p.amount), diff: null,
        status: 'pdf_only', pdfPeriod: p.period || null, pdfFiles: p.files,
      })
    }

    const order: Record<Row['status'], number> = { mismatch: 0, pdf_only: 1, report_only: 2, match: 3 }
    rows.sort((a, b) => order[a.status] - order[b.status] || a.account.localeCompare(b.account))

    const cnt = (s: Row['status']) => rows.filter(r => r.status === s).length
    const summary = {
      total: rows.length,
      match: cnt('match'),
      mismatch: cnt('mismatch'),
      pdfOnly: cnt('pdf_only'),
      reportOnly: cnt('report_only'),
      reportTotal: round2([...byReport.values()].reduce((s, v) => s + v.amount, 0)),
      pdfTotal:    round2([...byPdf.values()].reduce((s, v) => s + v.amount, 0)),
      // 검증된 계정만의 합계 차이 — 전체 차이는 미업로드분 때문에 의미가 흐려져서 분리
      checkedDiff: round2(rows
        .filter(r => r.status === 'match' || r.status === 'mismatch')
        .reduce((s, r) => s + (r.diff ?? 0), 0)),
      allClear: cnt('mismatch') === 0 && cnt('pdf_only') === 0,
    }

    return NextResponse.json({ report, summary, rows })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '대조 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
