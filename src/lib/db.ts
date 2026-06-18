// =============================================================
// Aetheris RCT Platform — Data-Fetching Layer
// All functions use the public Supabase client (anon key + RLS).
// Admin functions that need to bypass RLS must be called from a
// trusted server environment using the service-role key.
// =============================================================

import { supabase } from '@/lib/supabase'
import type {
  Profile,
  RankHistoryEntry,
  TreeNode,
  DownlineRow,
  LegStats,
  LegSide,
  RankCounts,
  DashboardData,
  SponsorInfo,
  Rank,
  LegPosition,
  ProfitReport,
  ProfitReportItem,
  ParsedPdfReport,
  ReportStatus,
} from '@/lib/types'

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

/** Build a zero-initialised RankCounts object */
function emptyRankCounts(): RankCounts {
  return { R0: 0, R1: 0, R2: 0, R3: 0, R4: 0, R5: 0 }
}

/** Build a zero-initialised LegSide object */
function emptyLegSide(): LegSide {
  return { total: 0, sales: 0, rankCounts: emptyRankCounts() }
}

/**
 * Take a flat get_downline result and reconstruct a nested TreeNode.
 * The root node (depth 0) is the first element.
 */
function buildTree(rows: DownlineRow[]): TreeNode | null {
  if (rows.length === 0) return null

  const map = new Map<string, TreeNode>()

  // First pass: create all nodes with null children
  for (const row of rows) {
    map.set(row.id, { ...row, left: null, right: null })
  }

  let root: TreeNode | null = null

  // Second pass: wire up parent → child pointers
  for (const row of rows) {
    const node = map.get(row.id)!
    if (row.depth === 0) {
      root = node
      continue
    }
    if (row.parent_id) {
      const parent = map.get(row.parent_id)
      if (parent) {
        if (row.leg_position === 'LEFT') {
          parent.left = node
        } else if (row.leg_position === 'RIGHT') {
          parent.right = node
        }
      }
    }
  }

  return root
}

/**
 * Collect all descendant IDs that belong to one leg (LEFT or RIGHT)
 * of a given root member, starting from its direct child in that leg.
 */
function collectLegRows(
  allRows: DownlineRow[],
  directChildId: string,
): DownlineRow[] {
  const result: DownlineRow[] = []
  const queue: string[] = [directChildId]
  const idSet = new Set(queue)

  while (queue.length > 0) {
    const currentId = queue.shift()!
    for (const row of allRows) {
      if (row.parent_id === currentId && !idSet.has(row.id)) {
        idSet.add(row.id)
        queue.push(row.id)
      }
    }
  }

  for (const row of allRows) {
    if (idSet.has(row.id)) result.push(row)
  }

  return result
}

/** Aggregate count / sales / rank breakdown from a list of rows */
function aggregateLeg(rows: DownlineRow[]): LegSide {
  const side = emptyLegSide()
  for (const row of rows) {
    side.total++
    side.sales += row.sales
    const r = row.rank as Rank
    if (r in side.rankCounts) side.rankCounts[r]++
  }
  return side
}

// ---------------------------------------------------------------
// Profile
// ---------------------------------------------------------------

/**
 * Fetch the currently authenticated user's profile.
 * Returns null if not signed in or profile does not exist yet.
 */
export async function getMyProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    // PGRST116 = no rows — profile not yet created
    if (error.code === 'PGRST116') return null
    console.error('[getMyProfile]', error)
    throw error
  }

  return data as Profile
}

/**
 * Update the current user's profile with the provided fields.
 * Only whitelisted mutable columns are allowed.
 */
export async function updateMyProfile(data: Partial<Pick<Profile, 'name' | 'sales'>>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('profiles')
    .update(data)
    .eq('id', user.id)

  if (error) {
    console.error('[updateMyProfile]', error)
    throw error
  }
}

// ---------------------------------------------------------------
// Tree
// ---------------------------------------------------------------

/**
 * Fetch the full downline of the given profile and return it as a
 * nested TreeNode (left / right children recursively populated).
 */
export async function getMyTree(profileId?: string): Promise<TreeNode | null> {
  let rootId = profileId
  if (!rootId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    rootId = user.id
  }

  const { data, error } = await supabase.rpc('get_downline', {
    root_id: rootId,
  })

  if (error) {
    console.error('[getMyTree]', error)
    throw error
  }

  return buildTree((data ?? []) as DownlineRow[])
}

/**
 * Compute left/right leg statistics for any given user ID.
 * Uses the get_downline RPC to retrieve all descendants, then
 * partitions them by leg.
 *
 * @param userId  The profile UUID whose legs are being analysed.
 */
export async function getLegStats(userId: string): Promise<LegStats> {
  const { data, error } = await supabase.rpc('get_downline', {
    root_id: userId,
  })

  if (error) {
    console.error('[getLegStats]', error)
    throw error
  }

  const rows = (data ?? []) as DownlineRow[]

  // Find direct LEFT and RIGHT children (depth 1)
  const leftChild  = rows.find(r => r.depth === 1 && r.leg_position === 'LEFT')
  const rightChild = rows.find(r => r.depth === 1 && r.leg_position === 'RIGHT')

  // 직추천 = referrer_id 기준 (추천 트리 1대)
  const directReferrals = rows.filter(r => r.referrer_id === userId && r.status === 'active').length

  const leftRows  = leftChild  ? collectLegRows(rows, leftChild.id)  : []
  const rightRows = rightChild ? collectLegRows(rows, rightChild.id) : []

  return {
    left: aggregateLeg(leftRows),
    right: aggregateLeg(rightRows),
    directReferrals,
  }
}

// ---------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------

/**
 * Single aggregated call that gathers everything the home page needs:
 *   - profile
 *   - leg stats
 *   - 10 most-recently-joined downline members
 *   - 5 most-recent rank changes
 */
export async function getDashboardData(userId: string): Promise<DashboardData> {
  // Run profile + downline + rank history in parallel
  const [profileResult, downlineResult, rankHistoryResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.rpc('get_downline', { root_id: userId }),
    supabase
      .from('rank_history')
      .select('*')
      .eq('profile_id', userId)
      .order('changed_at', { ascending: false })
      .limit(5),
  ])

  if (profileResult.error) {
    console.error('[getDashboardData] profile', profileResult.error)
    throw profileResult.error
  }
  if (downlineResult.error) {
    console.error('[getDashboardData] downline', downlineResult.error)
    throw downlineResult.error
  }
  if (rankHistoryResult.error) {
    console.error('[getDashboardData] rank_history', rankHistoryResult.error)
    throw rankHistoryResult.error
  }

  const allRows = (downlineResult.data ?? []) as DownlineRow[]

  // Leg stats (exclude root at depth 0)
  const descendants = allRows.filter(r => r.depth > 0)
  const leftChild   = allRows.find(r => r.depth === 1 && r.leg_position === 'LEFT')
  const rightChild  = allRows.find(r => r.depth === 1 && r.leg_position === 'RIGHT')

  // 직추천 = referrer_id 기준 (추천 트리 1대, rank-check 서버와 동일)
  // get_downline은 parent_id 트리 기준이므로 referrer_id 집계는 별도 카운트
  const directReferrals = allRows.filter(r => r.referrer_id === userId && r.status === 'active').length

  const leftRows  = leftChild  ? collectLegRows(descendants, leftChild.id)  : []
  const rightRows = rightChild ? collectLegRows(descendants, rightChild.id) : []

  const legStats: LegStats = {
    left: aggregateLeg(leftRows),
    right: aggregateLeg(rightRows),
    directReferrals,
  }

  // 10 most recently joined downline members (excluding self)
  const recentDownline = [...descendants]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)

  return {
    profile: profileResult.data as Profile,
    legStats,
    recentDownline,
    descendants,
    rankHistory: (rankHistoryResult.data ?? []) as RankHistoryEntry[],
  }
}

// ---------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------

/**
 * Fetch the full rank change history for a user, newest first.
 */
export async function getRankHistory(userId: string): Promise<RankHistoryEntry[]> {
  const { data, error } = await supabase
    .from('rank_history')
    .select('*')
    .eq('profile_id', userId)
    .order('changed_at', { ascending: false })

  if (error) {
    console.error('[getRankHistory]', error)
    throw error
  }

  return (data ?? []) as RankHistoryEntry[]
}

// ---------------------------------------------------------------
// Admin
// ---------------------------------------------------------------

/**
 * Fetch every profile in the database.
 *
 * NOTE: This requires either:
 *   (a) A Supabase admin policy that allows it, OR
 *   (b) A service-role client (never expose the service-role key
 *       to the browser — call this only from a server route).
 *
 * With default RLS the query will return only the caller's own row.
 * Create an admin policy or use the service-role client server-side.
 */
export async function getAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[getAllProfiles]', error)
    throw error
  }

  return (data ?? []) as Profile[]
}

// ---------------------------------------------------------------
// Registration
// ---------------------------------------------------------------

/**
 * 추천인/후원인 코드로 프로필을 조회합니다.
 * SECURITY DEFINER RPC이므로 비로그인 상태에서도 동작합니다.
 *
 * - 후원인(Sponsor) 조회: left_taken / right_taken 으로 레그 점유 여부 확인
 * - 추천인(Referrer) 조회: 같은 RPC 사용, left/right_taken은 무시해도 됨
 *
 * Returns null if the code does not match any profile.
 */
export async function validateReferralCode(code: string): Promise<SponsorInfo | null> {
  const { data, error } = await supabase.rpc('validate_referral_code', {
    code: code.trim().toUpperCase(),
  })

  if (error) {
    console.error('[validateReferralCode]', error)
    throw error
  }

  // RPC returns an array; the code is unique so at most one row
  const rows = (data ?? []) as SponsorInfo[]
  return rows.length > 0 ? rows[0] : null
}

/**
 * Create a new profile row immediately after Supabase Auth sign-up.
 *
 * @param code         The sponsor's referral code
 * @param userId       The new user's auth UUID (from session)
 * @param name         The new user's display name
 * @param legPosition  Which leg to place the new member under the sponsor
 *
 * The DB trigger (handle_new_profile) auto-generates node_id, ct_id,
 * and referral_code, so we only supply the relational fields.
 */
export async function registerWithCode(
  code: string,
  userId: string,
  name: string,
  legPosition: LegPosition,
): Promise<void> {
  // 1. Resolve the sponsor
  const sponsor = await validateReferralCode(code)
  if (!sponsor) throw new Error('Invalid referral code')

  // 2. Check the requested leg is still free
  if (legPosition === 'LEFT'  && sponsor.left_taken)  throw new Error('Left leg is already occupied')
  if (legPosition === 'RIGHT' && sponsor.right_taken) throw new Error('Right leg is already occupied')

  // 3. Insert the new profile (trigger fills node_id / ct_id / referral_code)
  const { error } = await supabase.from('profiles').insert({
    id:           userId,
    name,
    parent_id:    sponsor.profile_id,
    leg_position: legPosition,
    // node_id, ct_id, referral_code left blank → trigger fills them
    node_id:      '',
    ct_id:        '',
    referral_code: '',
  })

  if (error) {
    console.error('[registerWithCode]', error)
    throw error
  }
}

// ---------------------------------------------------------------
// Member Payout Reports (RLS: own rows only)
// ---------------------------------------------------------------

export type MemberReportWithItems = ProfitReport & { items: ProfitReportItem[] }

/**
 * Save a parsed PDF report for the current member.
 * Matches the PDF's mt5_account_id to their own profile — rejects if mismatch.
 */
export async function memberSaveProfitReport(
  parsed: ParsedPdfReport,
  profileId: string,
  mt5AccountId: string,
): Promise<void> {
  if (parsed.mt5AccountId !== mt5AccountId) {
    throw new Error(`PDF의 MT5 계좌(${parsed.mt5AccountId})가 내 계좌(${mt5AccountId})와 일치하지 않습니다.`)
  }

  // 프로필 정보 조회 (matched_* 필드 채우기 위해)
  const { data: profileData } = await supabase
    .from('profiles')
    .select('node_id, name, trc20_address')
    .eq('id', profileId)
    .single()

  // Insert report
  const reportId = crypto.randomUUID()
  const { error: rErr } = await supabase.from('profit_reports').insert({
    id:           reportId,
    profile_id:   profileId,   // ← 올바른 컬럼명 (owner_profile_id → profile_id)
    date_from:    parsed.dateFrom,
    date_to:      parsed.dateTo,
    uploaded_at:  new Date().toISOString(),
    total_unpaid: parsed.totalUnpaid,
    status:       'pending' as ReportStatus,
  })
  if (rErr) throw new Error(rErr.message)

  // Insert items
  const items = parsed.items.map(item => ({
    id:                   crypto.randomUUID(),
    report_id:            reportId,
    mt5_account_id:       parsed.mt5AccountId,
    strategy_name:        item.strategyName,
    distributable_income: item.distributedIncome,
    profit_ratio:         item.profitRatio,
    unpaid_profit:        item.unpaidProfit,
    matched_profile_id:   profileId,
    matched_node_id:      profileData?.node_id ?? null,
    matched_name:         profileData?.name    ?? null,
    trc20_address:        profileData?.trc20_address ?? null,
  }))

  const { error: iErr } = await supabase.from('profit_report_items').insert(items)
  if (iErr) throw new Error(iErr.message)
}

/** Get all payout reports belonging to this profile */
export async function memberGetProfitReports(profileId: string): Promise<MemberReportWithItems[]> {
  const { data: reports, error: rErr } = await supabase
    .from('profit_reports')
    .select('*')
    .eq('profile_id', profileId)   // ← owner_profile_id → profile_id
    .order('uploaded_at', { ascending: false })

  if (rErr) throw new Error(rErr.message)
  if (!reports?.length) return []

  const ids = reports.map(r => r.id)
  const { data: items, error: iErr } = await supabase
    .from('profit_report_items')
    .select('*')
    .in('report_id', ids)

  if (iErr) throw new Error(iErr.message)

  return reports.map(r => ({
    ...r,
    items: (items ?? []).filter(i => i.report_id === r.id),
  }))
}
