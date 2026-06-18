/**
 * GET /api/company-revenue
 *
 * 회사 매출(회사에 귀속되는 모든 돈) 집계. 관리자 전용(service-role).
 *
 * 모델:
 *   총매출(분윤)   = Σ profit_reports.total_unpaid
 *   회사 기본수익  = 총매출 × 20%
 *   회원 지급액    = Σ payout_distributions.amount
 *   낙전           = 총매출 × 80% − 회원 지급액   (회원 몫 중 미지급분)
 *   회사 총수입    = 회사 기본수익 + 낙전 = 총매출 − 회원 지급액
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const COMPANY_RATIO = 0.20
const MEMBER_RATIO  = 0.80

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim()
  if (!token) return false
  const { data } = await admin.auth.getUser(token)
  return data.user?.user_metadata?.role === 'admin'
}

export async function GET(req: NextRequest) {
  try {
    if (!await verifyAdmin(req)) {
      return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
    }

    const [{ data: reports }, { data: dists }, { data: forf }] = await Promise.all([
      admin.from('profit_reports').select('total_unpaid'),
      admin.from('payout_distributions').select('amount'),
      admin.from('forfeited_bonuses').select('amount'),
    ])

    const totalProfit = (reports ?? []).reduce((s, r) => s + Number(r.total_unpaid ?? 0), 0)
    const totalPaid   = (dists   ?? []).reduce((s, r) => s + Number(r.amount       ?? 0), 0)
    const forfeitRecorded = (forf ?? []).reduce((s, r) => s + Number(r.amount       ?? 0), 0)

    const companyBase = totalProfit * COMPANY_RATIO
    const memberPool  = totalProfit * MEMBER_RATIO
    const forfeiture  = Math.max(0, memberPool - totalPaid)   // 회원 몫 중 미지급 = 낙전
    const companyTotal = companyBase + forfeiture             // = totalProfit - totalPaid

    return NextResponse.json({
      totalProfit,
      companyBase,
      memberPool,
      totalPaid,
      forfeiture,
      forfeitRecorded,   // 정지·제명·수동 등 사유가 기록된 낙전(낙전 전체의 부분집합)
      companyTotal,
      reportCount: (reports ?? []).length,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '집계 오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
