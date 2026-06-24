import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from '../App'

describe('App', () => {
  it('渲染占位文案', () => {
    render(<App />)
    expect(screen.getAllByText('待办').length).toBeGreaterThan(0)
  })
})
