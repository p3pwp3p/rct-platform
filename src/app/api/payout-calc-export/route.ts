/**
 * POST /api/payout-calc-export
 *
 * 수당을 "계산만" 해서 엑셀(.xlsx)로 내보낸다. DB 에는 아무것도 쓰지 않는다.
 * (payout-calc 의 preview 와 동일한 계산 경로를 쓰되, 결과를 파일로 뽑는 용도)
 *
 * body: { reportId: string }
 *
 * 시트 구성
 *   1) 계정별 지급    — 실제 송금 단위. 한 계정이 가진 모든 노드의 수당을 합산한 금액
 *   2) 노드별 상세    — 노드 하나하나의 수당 (검증/대사용)
 *   3) Binance 송금   — 일괄전송 업로드용 (No./Address/Amount/Currency/Remark)
 *   4) 송금 제외      — 주소 미등록 등으로 빠진 건 (누락 사고 방지용)
 *   5) 요약          — 총계·낙전·송금 건수
 *
 * "계정"이란: 노드는 여러 개여도 로그인 계정(auth user)은 하나 — 송금은 계정당 1번.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'
import {
  calcAllBonuses,
  summarizeByRecipient,
  type PayoutNode,
  type EarnerItem,
} from '@/lib/payout-engine'
import { rateLimit, clientIp, tooMany } from '@/lib/rate-limit'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  if (!token) return false
  const { data } = await admin.auth.getUser(token)
  return data.user?.app_metadata?.role === 'admin'
}

/** profiles 는 1000행 페이지 제한이 있어 전체를 받으려면 페이지네이션 필수 */
async function fetchAllProfiles() {
  const rows: {
    id: string; node_id: string; name: string; rank: string; status: string
    parent_id: string | null; referrer_id: string | null; leg_position: string | null
    owner_id: string | null; trc20_address: string | null; mt5_account_id: string | null
  }[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('profiles')
      .select('id, node_id, name, rank, status, parent_id, referrer_id, leg_position, owner_id, trc20_address, mt5_account_id')
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data?.length) break
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

export async function POST(req: NextRequest) {
  try {
    if (!await verifyAdmin(req)) {
      return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
    }
    if (!await rateLimit(`payout-calc-export:${clientIp(req)}`, 10, 60)) {
      return NextResponse.json(tooMany, { status: 429 })
    }

    const { reportId } = await req.json()
    if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 })

    // ── 1. 보고서 메타 ─────────────────────────────────────────────────────
    const { data: reportMeta } = await admin
      .from('profit_reports')
      .select('id, status, date_from, date_to')
      .eq('id', reportId)
      .maybeSingle()
    if (!reportMeta) {
      return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 })
    }

    // ── 2. 정산 대상(분윤) 로드 ─────────────────────────────────────────────
    const { data: items, error: itemErr } = await admin
      .from('profit_report_items')
      .select('matched_profile_id, unpaid_profit')
      .eq('report_id', reportId)
      .not('matched_profile_id', 'is', null)
    if (itemErr) throw itemErr
    if (!items?.length) {
      return NextResponse.json({ error: '보고서에 매칭된 프로필 없음' }, { status: 400 })
    }

    const earners: EarnerItem[] = items.map(i => ({
      profile_id:    i.matched_profile_id as string,
      unpaid_profit: i.unpaid_profit as number,
    }))

    // ── 3. 전체 프로필 + 노드맵 ─────────────────────────────────────────────
    const profiles = await fetchAllProfiles()
    const nodeMap = new Map<string, PayoutNode>()
    for (const p of profiles) nodeMap.set(p.id, p as unknown as PayoutNode)
    const profileById = new Map(profiles.map(p => [p.id, p]))

    // ── 4. 같은 달 기존 후원수당 누계 (월 한도 공유) — payout-calc 과 동일 규칙 ──
    const reportMonth = reportMeta.date_from.slice(0, 7)
    const monthStart = reportMonth + '-01'
    const nextMonthDate = new Date(monthStart)
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1)
    const nextMonthStart = nextMonthDate.toISOString().slice(0, 10)

    const { data: sameMonthReports } = await admin
      .from('profit_reports')
      .select('id')
      .gte('date_from', monthStart)
      .lt('date_from', nextMonthStart)
      .neq('id', reportId)

    const alreadyPaidMap = new Map<string, number>()
    if (sameMonthReports?.length) {
      const { data: prevSponsor } = await admin
        .from('payout_distributions')
        .select('recipient_id, amount')
        .eq('bonus_type', 'sponsor')
        .in('report_id', sameMonthReports.map(r => r.id))
      for (const row of (prevSponsor ?? [])) {
        alreadyPaidMap.set(row.recipient_id, (alreadyPaidMap.get(row.recipient_id) ?? 0) + row.amount)
      }
    }

    // ── 5. 계산 (DB 저장 없음) ──────────────────────────────────────────────
    const { distributions, forfeited, companyForfeited } = calcAllBonuses(earners, nodeMap, alreadyPaidMap)
    const perNode = summarizeByRecipient(distributions)

    // ── 6. 계정 귀속 판정 ───────────────────────────────────────────────────
    // owner_id 가 없는 placeholder 노드는 parent 체인을 타고 올라가 실제 계정을 찾는다
    // (admin/accounts 라우트와 동일한 규칙)
    const authUsers: { id: string; email?: string }[] = []
    for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) throw error
      authUsers.push(...data.users)
      if (data.users.length < 1000) break
    }
    const authUserIds = new Set(authUsers.map(u => u.id))
    const emailById = new Map(authUsers.map(u => [u.id, u.email ?? '']))

    function resolveAccountId(p: typeof profiles[0]): string {
      if (p.owner_id) return p.owner_id
      if (authUserIds.has(p.id)) return p.id
      let cur = p
      for (let i = 0; i < 20; i++) {
        if (!cur.parent_id) break
        const parent = profileById.get(cur.parent_id)
        if (!parent) break
        if (parent.owner_id) return parent.owner_id
        if (authUserIds.has(parent.id)) return parent.id
        cur = parent
      }
      return p.id
    }

    // ── 7. 노드별 행 만들기 ─────────────────────────────────────────────────
    type NodeRow = {
      accountId: string
      nodeId: string; name: string; rank: string
      referral: number; rank_bonus: number; sponsor: number; total: number
    }
    const nodeRows: NodeRow[] = []
    for (const [profileId, s] of perNode.entries()) {
      const p = profileById.get(profileId)
      nodeRows.push({
        accountId:  p ? resolveAccountId(p) : profileId,
        nodeId:     p?.node_id ?? profileId,
        name:       p?.name ?? '',
        rank:       p?.rank ?? '',
        referral:   s.referral,
        rank_bonus: s.rank,
        sponsor:    s.sponsor,
        total:      s.total,
      })
    }
    nodeRows.sort((a, b) => b.total - a.total)

    // ── 8. 계정별 합산 ─────────────────────────────────────────────────────
    type AccountRow = {
      accountId: string; email: string; mainName: string; trc20: string
      nodeCount: number; nodeIds: string[]
      referral: number; rank_bonus: number; sponsor: number; total: number
    }
    const accMap = new Map<string, AccountRow>()
    for (const r of nodeRows) {
      const cur = accMap.get(r.accountId) ?? {
        accountId: r.accountId,
        email:     emailById.get(r.accountId) ?? '',
        mainName:  '',
        trc20:     '',
        nodeCount: 0, nodeIds: [],
        referral: 0, rank_bonus: 0, sponsor: 0, total: 0,
      }
      cur.nodeCount += 1
      cur.nodeIds.push(r.nodeId)
      cur.referral   += r.referral
      cur.rank_bonus += r.rank_bonus
      cur.sponsor    += r.sponsor
      cur.total      += r.total
      accMap.set(r.accountId, cur)
    }
    // 계정 대표 정보(이름/TRC-20)
    // 주의: 계정 id 는 auth user id 라서 같은 id 를 가진 profiles 행이 없는 경우가 많다.
    // (노드 행의 owner_id 가 계정을 가리키는 구조) → 없으면 그 계정이 가진 노드에서 보완한다.
    const nodesOfAccount = new Map<string, typeof profiles>()
    for (const p of profiles) {
      const k = resolveAccountId(p)
      const arr = nodesOfAccount.get(k) ?? []
      arr.push(p)
      nodesOfAccount.set(k, arr)
    }
    for (const acc of accMap.values()) {
      const main  = profileById.get(acc.accountId)
      const owned = (nodesOfAccount.get(acc.accountId) ?? [])
        .slice()
        .sort((a, b) => a.node_id.localeCompare(b.node_id))
      acc.mainName = main?.name ?? owned[0]?.name ?? ''
      acc.trc20    = main?.trc20_address ?? owned.find(p => p.trc20_address)?.trc20_address ?? ''
      acc.nodeIds.sort()
    }
    const accountRows = [...accMap.values()].sort((a, b) => b.total - a.total)

    // ── 9. 엑셀 생성 ───────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook()
    wb.created = new Date()

    const money = '#,##0.00'
    const headerFill: ExcelJS.Fill = {
      type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' },
    }
    const styleHeader = (ws: ExcelJS.Worksheet) => {
      const row = ws.getRow(1)
      row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
      row.fill = headerFill
      row.alignment = { vertical: 'middle' }
      row.height = 22
      ws.views = [{ state: 'frozen', ySplit: 1 }]
    }

    // 시트 1 — 계정별 지급 (실제 송금 단위)
    const ws1 = wb.addWorksheet('계정별 지급')
    ws1.columns = [
      { header: '계정 이메일',   key: 'email',     width: 30 },
      { header: '대표 이름',     key: 'mainName',  width: 14 },
      { header: 'TRC-20 주소',   key: 'trc20',     width: 40 },
      { header: '노드 수',       key: 'nodeCount', width: 9  },
      { header: '추천수당',      key: 'referral',  width: 14, style: { numFmt: money } },
      { header: '직급수당',      key: 'rank',      width: 14, style: { numFmt: money } },
      { header: '후원수당',      key: 'sponsor',   width: 14, style: { numFmt: money } },
      { header: '총 지급액',     key: 'total',     width: 16, style: { numFmt: money } },
      { header: '보유 노드',     key: 'nodeIds',   width: 40 },
    ]
    for (const a of accountRows) {
      ws1.addRow({
        email: a.email || '(계정 미연결)',
        mainName: a.mainName, trc20: a.trc20,
        nodeCount: a.nodeCount,
        referral: a.referral, rank: a.rank_bonus, sponsor: a.sponsor, total: a.total,
        nodeIds: a.nodeIds.join(', '),
      })
    }
    // 합계 행
    const accTotalRow = ws1.addRow({
      email: '합계', mainName: '', trc20: '', nodeCount: accountRows.length,
      referral: accountRows.reduce((s, a) => s + a.referral, 0),
      rank:     accountRows.reduce((s, a) => s + a.rank_bonus, 0),
      sponsor:  accountRows.reduce((s, a) => s + a.sponsor, 0),
      total:    accountRows.reduce((s, a) => s + a.total, 0),
      nodeIds: '',
    })
    accTotalRow.font = { bold: true }
    accTotalRow.border = { top: { style: 'double' } }
    styleHeader(ws1)

    // 시트 2 — 노드별 상세
    const ws2 = wb.addWorksheet('노드별 상세')
    ws2.columns = [
      { header: 'Node ID',     key: 'nodeId',   width: 16 },
      { header: '이름',        key: 'name',     width: 14 },
      { header: '직급',        key: 'rank',     width: 10 },
      { header: '소속 계정',   key: 'email',    width: 30 },
      { header: '추천수당',    key: 'referral', width: 14, style: { numFmt: money } },
      { header: '직급수당',    key: 'rankB',    width: 14, style: { numFmt: money } },
      { header: '후원수당',    key: 'sponsor',  width: 14, style: { numFmt: money } },
      { header: '합계',        key: 'total',    width: 16, style: { numFmt: money } },
    ]
    for (const r of nodeRows) {
      ws2.addRow({
        nodeId: r.nodeId, name: r.name, rank: r.rank,
        email: emailById.get(r.accountId) ?? '(계정 미연결)',
        referral: r.referral, rankB: r.rank_bonus, sponsor: r.sponsor, total: r.total,
      })
    }
    const nodeTotalRow = ws2.addRow({
      nodeId: '합계', name: '', rank: '', email: '',
      referral: nodeRows.reduce((s, r) => s + r.referral, 0),
      rankB:    nodeRows.reduce((s, r) => s + r.rank_bonus, 0),
      sponsor:  nodeRows.reduce((s, r) => s + r.sponsor, 0),
      total:    nodeRows.reduce((s, r) => s + r.total, 0),
    })
    nodeTotalRow.font = { bold: true }
    nodeTotalRow.border = { top: { style: 'double' } }
    styleHeader(ws2)

    // 시트 3 — Binance 일괄송금
    // Binance 일괄전송 업로드용. 결과 CSV 파서가 기대하는 컬럼명과 맞춰둔다
    // (No./Address/Amount/Currency/Remark). 지갑주소가 없으면 송금이 불가하므로
    // 제외하되, 아래 "송금 제외" 시트에 남겨 누락을 눈치채게 한다.
    const USDT_MIN = 0.01   // 소수점 2자리 아래는 송금 불가 — 반올림 후 0 이면 제외
    const payable = accountRows
      .map(a => ({ ...a, payAmount: Math.round(a.total * 100) / 100 }))
      .filter(a => a.trc20 && a.payAmount >= USDT_MIN)
    const excluded = accountRows
      .map(a => ({ ...a, payAmount: Math.round(a.total * 100) / 100 }))
      .filter(a => !(a.trc20 && a.payAmount >= USDT_MIN))
      .map(a => ({
        ...a,
        reason: !a.trc20 ? 'TRC-20 주소 미등록' : '금액이 최소 단위 미만',
      }))

    const wsB = wb.addWorksheet('Binance 송금')
    wsB.columns = [
      { header: 'No.',      key: 'no',       width: 7  },
      { header: 'Address',  key: 'address',  width: 42 },
      { header: 'Amount',   key: 'amount',   width: 14, style: { numFmt: '0.00' } },
      { header: 'Currency', key: 'currency', width: 10 },
      { header: 'Remark',   key: 'remark',   width: 34 },
    ]
    payable.forEach((a, i) => {
      wsB.addRow({
        no: i + 1,
        address: a.trc20,
        amount: a.payAmount,
        currency: 'USDT',
        // 결과 대사용 — 누구에게 보낸 건지 식별
        remark: `${a.mainName || a.email} ${a.nodeIds.join('/')}`.trim(),
      })
    })
    styleHeader(wsB)

    // 시트 4 — 송금 제외(주소 없음 등). 조용히 빠지면 미지급 사고로 이어져서 명시
    const wsX = wb.addWorksheet('송금 제외')
    wsX.columns = [
      { header: '계정 이메일', key: 'email',    width: 30 },
      { header: '대표 이름',   key: 'mainName', width: 14 },
      { header: '보유 노드',   key: 'nodeIds',  width: 30 },
      { header: '금액',        key: 'amount',   width: 14, style: { numFmt: money } },
      { header: '제외 사유',   key: 'reason',   width: 24 },
    ]
    for (const a of excluded) {
      wsX.addRow({
        email: a.email || '(계정 미연결)', mainName: a.mainName,
        nodeIds: a.nodeIds.join(', '), amount: a.payAmount, reason: a.reason,
      })
    }
    if (excluded.length === 0) wsX.addRow({ email: '(없음 — 전원 송금 가능)' })
    styleHeader(wsX)

    // 시트 5 — 요약
    const totalBase      = earners.reduce((s, e) => s + e.unpaid_profit, 0)
    const totalReferral  = nodeRows.reduce((s, r) => s + r.referral, 0)
    const totalRank      = nodeRows.reduce((s, r) => s + r.rank_bonus, 0)
    const totalSponsor   = nodeRows.reduce((s, r) => s + r.sponsor, 0)
    const totalForfeited = forfeited.reduce((s, f) => s + f.amount, 0)

    const ws3 = wb.addWorksheet('요약')
    ws3.columns = [
      { header: '항목', key: 'k', width: 28 },
      { header: '값',   key: 'v', width: 24 },
    ]
    const addSummary = (k: string, v: string | number, isMoney = false) => {
      const row = ws3.addRow({ k, v })
      if (isMoney) row.getCell('v').numFmt = money
    }
    addSummary('보고서 기간', `${reportMeta.date_from} ~ ${reportMeta.date_to}`)
    addSummary('보고서 상태', reportMeta.status)
    addSummary('정산 대상 노드 수', earners.length)
    addSummary('분윤 총합', totalBase, true)
    addSummary('추천수당 합계', totalReferral, true)
    addSummary('직급수당 합계', totalRank, true)
    addSummary('후원수당 합계', totalSponsor, true)
    addSummary('총 분배액', totalReferral + totalRank + totalSponsor, true)
    addSummary(`낙전 (${forfeited.length}건)`, totalForfeited, true)
    addSummary('회사 귀속(적격자 없는 tier)', companyForfeited, true)
    addSummary('지급 대상 계정 수', accountRows.length)
    addSummary('지급 대상 노드 수', nodeRows.length)
    addSummary('Binance 송금 건수', payable.length)
    addSummary('Binance 송금 합계', payable.reduce((s, a) => s + a.payAmount, 0), true)
    addSummary('송금 제외 건수', excluded.length)
    addSummary('송금 제외 합계', excluded.reduce((s, a) => s + a.payAmount, 0), true)
    addSummary('생성 시각', new Date().toLocaleString('ko-KR'))
    addSummary('비고', '계산 전용 — DB에 저장되지 않음')
    styleHeader(ws3)

    const buf = await wb.xlsx.writeBuffer()
    const fname = `payout_calc_${reportMeta.date_from}_${reportId.slice(0, 8)}.xlsx`

    return new NextResponse(buf as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fname}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? '엑셀 내보내기 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
