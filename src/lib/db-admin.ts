// =============================================================
// Aetheris RCT Platform — Admin Data Layer
// Requires: caller is authenticated + has role='admin' in user_metadata.
// The admin RLS policies enforce this on the DB side.
// =============================================================

import { supabase } from '@/lib/supabase'
import type { Profile, DownlineRow, TreeNode, Rank, LegPosition, ProfitReport, ProfitReportItem, ParsedPdfReport, CsvExportLog } from '@/lib/types'

// ---------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------

function buildTree(rows: DownlineRow[]): TreeNode | null {
  if (!rows.length) return null
  const map = new Map<string, TreeNode>()
  for (const row of rows) map.set(row.id, { ...row, left: null, right: null })
  let root: TreeNode | null = null
  for (const row of rows) {
    const node = map.get(row.id)!
    if (row.depth === 0) { root = node; continue }
    if (row.parent_id) {
      const parent = map.get(row.parent_id)
      if (parent) {
        if (row.leg_position === 'LEFT')  parent.left  = node
        if (row.leg_position === 'RIGHT') parent.right = node
      }
    }
  }
  return root
}

// Compute depth map from flat profiles (parent_id links)
export function computeDepths(profiles: Profile[]): Map<string, number> {
  const parentMap = new Map(profiles.map(p => [p.id, p.parent_id]))
  const depths    = new Map<string, number>()

  function depth(id: string): number {
    if (depths.has(id)) return depths.get(id)!
    const pid = parentMap.get(id)
    const d   = pid ? depth(pid) + 1 : 0
    depths.set(id, d)
    return d
  }
  for (const p of profiles) depth(p.id)
  return depths
}

// ---------------------------------------------------------------
// Core: fetch ALL profiles (admin-only RLS gate)
// ---------------------------------------------------------------

export async function adminGetAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) { console.error('[adminGetAllProfiles]', error); throw error }
  return (data ?? []) as Profile[]
}

// ---------------------------------------------------------------
// Stats for admin home
// ---------------------------------------------------------------

export interface AdminStats {
  totalMembers:  number
  totalSales:    number
  recentMembers: Profile[]           // 5 most recent
  recentJoined:  AdminLegRow[]       // 10 most recent registrations (has parent_id)
}

export interface AdminLegRow {
  profile:   Profile
  sponsor:   Profile | null
  referrer:  Profile | null
  depth:     number
}

export async function adminGetStats(): Promise<AdminStats> {
  const profiles = await adminGetAllProfiles()
  const byId     = new Map(profiles.map(p => [p.id, p]))
  const depths   = computeDepths(profiles)

  const sorted   = [...profiles].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const recentJoined: AdminLegRow[] = sorted
    .filter(p => p.parent_id !== null)
    .slice(0, 10)
    .map(p => ({
      profile:  p,
      sponsor:  p.parent_id   ? (byId.get(p.parent_id)   ?? null) : null,
      referrer: p.referrer_id ? (byId.get(p.referrer_id) ?? null) : null,
      depth:    depths.get(p.id) ?? 0,
    }))

  return {
    totalMembers:  profiles.length,
    totalSales:    profiles.reduce((s, p) => s + (p.sales ?? 0), 0),
    recentMembers: sorted.slice(0, 5),
    recentJoined,
  }
}

// ---------------------------------------------------------------
// Members (with children count)
// ---------------------------------------------------------------

export interface AdminMember {
  profile:       Profile
  directLegs:    Profile[]   // direct children (max 2 in binary)
  ownedNodes:    Profile[]   // 같은 소유자(owner)가 보유한 모든 노드 (자기 자신 포함)
  totalDownline: number      // full subtree count (excl self)
  depth:         number
}

// 노드의 소유자 키: owner_id 우선, 없으면 자기 자신(id) = 본인 소유 노드
function ownerKey(p: Profile): string {
  return p.owner_id ?? p.id
}

export async function adminGetMembers(): Promise<AdminMember[]> {
  const profiles = await adminGetAllProfiles()
  const byId     = new Map(profiles.map(p => [p.id, p]))
  const depths   = computeDepths(profiles)

  // Group by parent_id
  const childrenOf = new Map<string, Profile[]>()
  for (const p of profiles) {
    if (p.parent_id) {
      const arr = childrenOf.get(p.parent_id) ?? []
      arr.push(p)
      childrenOf.set(p.parent_id, arr)
    }
  }

  // Group by owner (소유자별 보유 노드)
  const nodesByOwner = new Map<string, Profile[]>()
  for (const p of profiles) {
    const key = ownerKey(p)
    const arr = nodesByOwner.get(key) ?? []
    arr.push(p)
    nodesByOwner.set(key, arr)
  }

  // Count full subtree recursively
  function subtreeCount(id: string): number {
    const children = childrenOf.get(id) ?? []
    return children.reduce((s, c) => s + 1 + subtreeCount(c.id), 0)
  }

  return profiles.map(p => ({
    profile:       p,
    directLegs:    childrenOf.get(p.id) ?? [],
    ownedNodes:    nodesByOwner.get(ownerKey(p)) ?? [p],
    totalDownline: subtreeCount(p.id),
    depth:         depths.get(p.id) ?? 0,
  }))
}

// ---------------------------------------------------------------
// Legs (all profiles that have a parent)
// ---------------------------------------------------------------

export interface AdminLeg {
  profile:  Profile
  sponsor:  Profile | null
  referrer: Profile | null
  depth:    number
}

export async function adminGetLegs(): Promise<AdminLeg[]> {
  const profiles = await adminGetAllProfiles()
  const byId     = new Map(profiles.map(p => [p.id, p]))
  const depths   = computeDepths(profiles)

  return profiles
    .filter(p => p.parent_id !== null)
    .map(p => ({
      profile:  p,
      sponsor:  p.parent_id   ? (byId.get(p.parent_id)   ?? null) : null,
      referrer: p.referrer_id ? (byId.get(p.referrer_id) ?? null) : null,
      depth:    depths.get(p.id) ?? 0,
    }))
}

// ---------------------------------------------------------------
// Tree (for binary tree viewer)
// ---------------------------------------------------------------

// ---------------------------------------------------------------
// Profit Reports (복사기 이익 공유 보고서)
// ---------------------------------------------------------------

export interface ProfitReportWithItems extends ProfitReport {
  items: ProfitReportItem[]
}

/** PDF 파싱 결과를 DB에 저장 + 노드 자동 매칭 */
export async function adminSaveProfitReport(parsed: ParsedPdfReport): Promise<ProfitReportWithItems> {
  const profiles = await adminGetAllProfiles()
  const byMt5 = new Map(
    profiles.filter(p => p.mt5_account_id).map(p => [p.mt5_account_id!, p])
  )

  const matched = byMt5.get(parsed.mt5AccountId) ?? null

  // 1. 보고서 생성 (profile_id = 매칭된 프로필 ID, 미매칭 시 null)
  const { data: report, error: rErr } = await supabase
    .from('profit_reports')
    .insert({
      profile_id:    matched?.id ?? null,
      date_from:     parsed.dateFrom,
      date_to:       parsed.dateTo,
      total_unpaid:  parsed.totalUnpaid,
      status:        'pending',
    })
    .select()
    .single()
  if (rErr || !report) throw rErr ?? new Error('보고서 생성 실패')

  // 2. 명세 항목 삽입
  const rows = parsed.items.map(item => ({
    report_id:            report.id,
    mt5_account_id:       parsed.mt5AccountId,
    strategy_name:        item.strategyName,
    distributable_income: item.distributedIncome,
    profit_ratio:         item.profitRatio,
    unpaid_profit:        item.unpaidProfit,
    matched_profile_id:   matched?.id ?? null,
    matched_node_id:      matched?.node_id ?? null,
    matched_name:         matched?.name ?? null,
    trc20_address:        matched?.trc20_address ?? null,
  }))

  const { data: items, error: iErr } = await supabase
    .from('profit_report_items')
    .insert(rows)
    .select()
  if (iErr) throw iErr

  return { ...report, items: (items ?? []) as ProfitReportItem[] }
}

/** 전체 보고서 목록 (최신순) */
export async function adminGetProfitReports(): Promise<ProfitReportWithItems[]> {
  const { data: reports, error: rErr } = await supabase
    .from('profit_reports')
    .select('*')
    .order('uploaded_at', { ascending: false })
  if (rErr) throw rErr

  const { data: items, error: iErr } = await supabase
    .from('profit_report_items')
    .select('*')
  if (iErr) throw iErr

  const itemsByReport = new Map<string, ProfitReportItem[]>()
  for (const item of (items ?? [])) {
    const arr = itemsByReport.get(item.report_id) ?? []
    arr.push(item as ProfitReportItem)
    itemsByReport.set(item.report_id, arr)
  }

  return (reports ?? []).map(r => ({
    ...(r as ProfitReport),
    items: itemsByReport.get(r.id) ?? [],
  }))
}

/** 보고서 상태 변경 (pending → confirmed → paid) */
export async function adminUpdateReportStatus(id: string, status: 'confirmed' | 'paid' | 'failed') {
  const { error } = await supabase
    .from('profit_reports')
    .update({ status })
    .eq('id', id)
  if (error) throw error
}

/** 보고서 삭제 */
export async function adminDeleteReport(id: string) {
  const { error } = await supabase
    .from('profit_reports')
    .delete()
    .eq('id', id)
  if (error) throw error
}

/**
 * Binance 실패 CSV 결과를 처리:
 * - 실패한 주소와 매칭되는 보고서를 'failed' 상태로 변경
 * - 성공한 보고서는 'paid'로 변경
 * Returns { failedCount, paidCount }
 */
export async function adminApplyBinanceResult(
  rows: Array<{ address: string; status: 'success' | 'failed'; reason: string }>,
): Promise<{ failedCount: number; paidCount: number }> {
  // 현재 confirmed 보고서 + items 로드
  const reports = await adminGetProfitReports()
  const confirmed = reports.filter(r => r.status === 'confirmed')

  // 주소 → 보고서 매핑
  const byAddress = new Map<string, ProfitReportWithItems>()
  for (const r of confirmed) {
    const addr = r.items[0]?.trc20_address
    if (addr) byAddress.set(addr.toLowerCase(), r)
  }

  let failedCount = 0
  let paidCount   = 0

  for (const row of rows) {
    const report = byAddress.get(row.address.toLowerCase())
    if (!report) continue

    if (row.status === 'failed') {
      await adminUpdateReportStatus(report.id, 'failed')
      failedCount++
    } else {
      await adminUpdateReportStatus(report.id, 'paid')
      paidCount++
    }
  }

  return { failedCount, paidCount }
}

/** MT5 계좌가 등록된 회원 중 특정 기간에 보고서를 제출하지 않은 회원 목록 */
export interface MissingMember {
  id: string
  name: string
  node_id: string
  mt5_account_id: string
  trc20_address: string | null
  created_at: string
}

export async function adminGetMissingMembers(
  dateFrom: string,
  dateTo: string,
): Promise<MissingMember[]> {
  // MT5 등록된 전체 회원
  const profiles = await adminGetAllProfiles()
  const withMt5  = profiles.filter(p => p.mt5_account_id)

  // 해당 기간에 제출된 보고서의 mt5_account_id 목록
  const { data: items, error } = await supabase
    .from('profit_report_items')
    .select('mt5_account_id, report_id')

  if (error) throw error

  // 기간 필터링을 위해 보고서 날짜도 조회
  const { data: reportsRaw } = await supabase
    .from('profit_reports')
    .select('id, date_from, date_to')
    .gte('date_from', dateFrom)
    .lte('date_to', dateTo)

  const submittedReportIds = new Set((reportsRaw ?? []).map((r: any) => r.id))
  const submittedMt5 = new Set(
    (items ?? [])
      .filter((i: any) => submittedReportIds.has(i.report_id))
      .map((i: any) => i.mt5_account_id as string)
  )

  return withMt5
    .filter(p => !submittedMt5.has(p.mt5_account_id!))
    .map(p => ({
      id:             p.id,
      name:           p.name,
      node_id:        p.node_id,
      mt5_account_id: p.mt5_account_id!,
      trc20_address:  p.trc20_address ?? null,
      created_at:     p.created_at ?? '',
    }))
}

// ---------------------------------------------------------------
// CSV Export Log
// ---------------------------------------------------------------

export async function adminSaveCsvExportLog(
  reports: ProfitReportWithItems[],
  note?: string,
): Promise<void> {
  const { error } = await supabase.from('csv_export_logs').insert({
    id:           crypto.randomUUID(),
    exported_at:  new Date().toISOString(),
    report_count: reports.length,
    total_amount: reports.reduce((s, r) => s + r.total_unpaid, 0),
    report_ids:   reports.map(r => r.id),
    note:         note ?? null,
  })
  if (error) throw error
}

export async function adminGetCsvExportLogs(): Promise<CsvExportLog[]> {
  const { data, error } = await supabase
    .from('csv_export_logs')
    .select('*')
    .order('exported_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as CsvExportLog[]
}

// ---------------------------------------------------------------
// Tree (for binary tree viewer)
// ---------------------------------------------------------------

export async function adminGetTree(): Promise<TreeNode | null> {
  const profiles = await adminGetAllProfiles()
  if (!profiles.length) return null

  // Find root (no parent)
  const root = profiles.find(p => !p.parent_id)
  if (!root) return null

  // Call get_downline from root (SECURITY DEFINER — works for admin)
  const { data, error } = await supabase.rpc('get_downline', { root_id: root.id })
  if (error) { console.error('[adminGetTree]', error); throw error }
  return buildTree((data ?? []) as DownlineRow[])
}
