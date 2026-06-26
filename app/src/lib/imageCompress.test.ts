import { describe, it, expect } from 'vitest'
import { scale } from './imageCompress'

// compressImage 依赖 Canvas（jsdom 无），手动验证；这里只测 scale 纯函数
describe('image scale', () => {
  it('小图不缩放', () => {
    expect(scale(800, 600, 1280)).toEqual({ width: 800, height: 600 })
  })
  it('大图按最长边缩', () => {
    expect(scale(2560, 1440, 1280)).toEqual({ width: 1280, height: 720 })
  })
  it('竖图按高缩', () => {
    expect(scale(1080, 2400, 1280)).toEqual({ width: 576, height: 1280 })
  })
})
