import { describe, it, expect } from 'vitest'
import { nextOrder, midpoint, orderForInsert } from './boardOrder'
describe('boardOrder', () => {
  it('nextOrder = max+1', () => { expect(nextOrder(5)).toBe(6); expect(nextOrder(0)).toBe(1) })
  it('midpoint 中点', () => { expect(midpoint(2, 4)).toBe(3); expect(midpoint(1, 2)).toBe(1.5) })
  it('orderForInsert 头部/中间/末尾', () => {
    expect(orderForInsert([2, 4, 6], 0, 6)).toBe(1)            // 头：midpoint(0,2)=1
    expect(orderForInsert([2, 4, 6], 1, 6)).toBe(3)            // 中：midpoint(2,4)=3
    expect(orderForInsert([2, 4, 6], 3, 6)).toBe(7)            // 末：nextOrder(6)=7
    expect(orderForInsert([], 0, 0)).toBe(1)                   // 空列首条
  })
})
