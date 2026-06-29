/** board_order 用 float 中点算法，支持无限次重排且无软删冲突。 */
export function nextOrder(maxOrder: number): number {
  return maxOrder + 1
}
export function midpoint(a: number, b: number): number {
  return (a + b) / 2
}
/** 给定同列已排序的 order 数组 + 目标插入索引，算新 order。插末尾用 nextOrder。 */
export function orderForInsert(sortedOrders: number[], insertIndex: number, maxOrder: number): number {
  if (insertIndex <= 0) return sortedOrders.length ? midpoint(0, sortedOrders[0]) : 1
  if (insertIndex >= sortedOrders.length) return nextOrder(maxOrder)
  return midpoint(sortedOrders[insertIndex - 1], sortedOrders[insertIndex])
}
