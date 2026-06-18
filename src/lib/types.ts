// =============================================================
// Aetheris RCT Platform — TypeScript Types
// Mirrors the Supabase schema exactly.
// =============================================================

export type Rank = 'R0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5'
export type LegPosition = 'LEFT' | 'RIGHT'

// ---------------------------------------------------------------
// Row shapes (match DB columns 1-to-1)
// ---------------------------------------------------------------

export interface Profile {
  id: string              // uuid — matches auth.users.id
  node_id: string         // 'RCT-00125'
  ct_id: string           // '1000125'
  name: string
  rank: Rank
  referral_code: string   // 8 chars
  sales: number
  parent_id: string | null
  leg_position: LegPosition | null
  owner_id: string | null     // 이 계좌를 소유/관리하는 auth user
  referrer_id: string | null  // 추천인 profile id
  trc20_address: string | null  // Tether TRC-20 출금 지갑 주소
  mt5_account_id: string | null // Vantage MT5 계좌 ID (카피ID)
  status: 'active' | 'suspended' | 'expelled'  // 회원 상태 (블랭크)
  vantage_ack: boolean          // Vantage 가입 안내 모달 확인 여부 (계정당 1회)
  created_at: string            // ISO 8601
}

// ---------------------------------------------------------------
// Profit Report (복사기 이익 공유 보고서)
// ---------------------------------------------------------------

export type ReportStatus = 'pending' | 'confirmed' | 'paid' | 'failed'

export interface ProfitReport {
  id: string
  date_from: string       // ISO date
  date_to: string
  uploaded_at: string
  total_unpaid: number
  status: ReportStatus
}

export interface ProfitReportItem {
  id: string
  report_id: string
  mt5_account_id: string
  strategy_name: string | null
  distributable_income: number
  profit_ratio: number
  unpaid_profit: number
  matched_profile_id: string | null
  matched_node_id: string | null
  matched_name: string | null
  trc20_address: string | null
}

// PDF 파싱 결과 (클라이언트 임시 타입)
export interface ParsedPdfReport {
  mt5AccountId: string
  dateFrom: string
  dateTo: string
  items: Array<{
    strategyName: string
    dateFrom: string
    dateTo: string
    distributedIncome: number
    profitRatio: number
    unpaidProfit: number
  }>
  totalUnpaid: number
}

export interface CsvExportLog {
  id: string
  exported_at: string       // ISO 8601
  report_count: number
  total_amount: number
  report_ids: string[]      // included profit_report ids
  note: string | null       // optional admin memo
}

export interface RankHistoryEntry {
  id: string
  profile_id: string
  old_rank: Rank
  new_rank: Rank
  changed_at: string      // ISO 8601
}

// ---------------------------------------------------------------
// Tree structures
// ---------------------------------------------------------------

/** Flat row returned by the get_downline RPC */
export interface DownlineRow {
  id: string
  node_id: string
  ct_id: string
  mt5_account_id: string | null
  name: string
  rank: Rank
  status: 'active' | 'suspended' | 'expelled'
  sales: number
  parent_id: string | null
  leg_position: LegPosition | null
  trc20_address: string | null
  referrer_id: string | null
  created_at: string
  depth: number
}

/** Recursive tree node (client-side reconstruction) */
export interface TreeNode extends DownlineRow {
  left: TreeNode | null
  right: TreeNode | null
}

// ---------------------------------------------------------------
// Aggregate / view models
// ---------------------------------------------------------------

export interface RankCounts {
  R0: number
  R1: number
  R2: number
  R3: number
  R4: number
  R5: number
}

export interface LegSide {
  total: number        // total member count in this leg
  activeCount: number  // members with status='active'
  sales: number        // cumulative sales in this leg
  topRank: Rank        // highest rank present in this leg
  latestJoinedAt: string | null  // ISO date of most recently joined node
  rankCounts: RankCounts
}

export interface LegStats {
  left: LegSide
  right: LegSide
  directReferrals: number  // count of depth-1 children (both legs combined)
}

/** Everything the home dashboard needs in one object */
export interface DashboardData {
  profile: Profile
  legStats: LegStats
  recentDownline: DownlineRow[]   // newest 10 members in the tree
  descendants: DownlineRow[]      // 전체 하위 노드 (depth > 0) — 시계열 분석용
  rankHistory: RankHistoryEntry[] // latest 5 rank changes
}

// ---------------------------------------------------------------
// Sponsor info returned by validate_referral_code RPC
// ---------------------------------------------------------------

export interface SponsorInfo {
  profile_id: string
  node_id: string
  name: string
  rank: Rank
  left_taken: boolean
  right_taken: boolean
}
