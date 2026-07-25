import { describe, it, expect } from 'vitest'
import { splitEven, parseProfitShareCsv, aggregateByCt, parsePeriod } from './profit-csv'

describe('splitEven — PF/N 센트 정확 분배', () => {
  it('나눠떨어지지 않으면 뒤쪽 노드가 나머지 센트 흡수', () => {
    const r = splitEven(122.71, 3)
    expect(r).toEqual([40.90, 40.90, 40.91])
    expect(r.reduce((s, x) => s + x, 0)).toBeCloseTo(122.71, 10)
  })

  it('나눠떨어지면 균등', () => {
    expect(splitEven(100, 4)).toEqual([25, 25, 25, 25])
  })

  it('N=1 이면 전액', () => {
    expect(splitEven(104.96, 1)).toEqual([104.96])
  })

  it('합계는 항상 원금과 정확히 일치(센트)', () => {
    for (const [total, n] of [[0.01, 3], [1, 7], [999.99, 13], [55.55, 6]] as [number, number][]) {
      const parts = splitEven(total, n)
      const sum = Math.round(parts.reduce((s, x) => s + x, 0) * 100)
      expect(sum).toBe(Math.round(total * 100))
      expect(parts).toHaveLength(n)
    }
  })

  it('N=0 이면 빈 배열', () => {
    expect(splitEven(50, 0)).toEqual([])
  })
})

describe('parseProfitShareCsv + aggregate', () => {
  const csv = [
    'followerMasterAccountNo,followerName,netProfit,sharedProfit,profitSharePercentage,lastSettlementPeriod',
    '20091821,Yung Moon Cho,245.41,122.71,0.50,2026-06-01 - 2026-06-30',
    '28551013,민혜영,-83.57,0.00,0.50,2026-06-01 - 2026-06-30',
    '20091821,Yung Moon Cho,10.00,5.00,0.50,2026-06-01 - 2026-06-30',
  ].join('\n')

  it('행 파싱', () => {
    const rows = parseProfitShareCsv(csv)
    expect(rows).toHaveLength(3)
    expect(rows[0].vantageCt).toBe('20091821')
    expect(rows[0].sharedProfit).toBe(122.71)
  })

  it('같은 CT 는 합산', () => {
    const agg = aggregateByCt(parseProfitShareCsv(csv))
    expect(agg.get('20091821')!.sharedProfit).toBeCloseTo(127.71, 10)
    expect(agg.get('28551013')!.sharedProfit).toBe(0)
  })

  it('기간 파싱', () => {
    expect(parsePeriod('2026-06-01 - 2026-06-30')).toEqual({ from: '2026-06-01', to: '2026-06-30' })
    expect(parsePeriod('없음')).toBeNull()
  })
})
