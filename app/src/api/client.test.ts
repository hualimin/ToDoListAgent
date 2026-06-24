import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createApiClient } from './client'

describe('api client', () => {
  const realFetch = globalThis.fetch
  beforeEach(() => { globalThis.fetch = vi.fn() as unknown as typeof fetch })
  afterEach(() => { globalThis.fetch = realFetch })

  it('带 baseURL 与 Bearer 令牌', async () => {
    const api = createApiClient({ baseURL: 'http://localhost:8000', token: 'tok-1' })
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    await api.get('/health')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/health',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok-1' }) }),
    )
  })

  it('4xx/5xx 抛错', async () => {
    const api = createApiClient({ baseURL: 'http://x', token: 't' })
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('err', { status: 500 }),
    )
    await expect(api.get('/x')).rejects.toThrow()
  })

  it('post 带 JSON body', async () => {
    const api = createApiClient({ baseURL: 'http://x', token: 't' })
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    )
    await api.post('/api/reminders', { task_ref: 'a' })
    const [, init] = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ task_ref: 'a' }))
  })
})
