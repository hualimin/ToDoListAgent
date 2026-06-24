import { create } from 'zustand'

const STORAGE_KEY = 'tdla.auth'
interface AuthState {
  baseURL: string
  token: string
  set: (baseURL: string, token: string) => void
}

function load(): { baseURL: string; token: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { baseURL: 'http://localhost:8000', token: '' }
}

export const useAuthStore = create<AuthState>((set) => {
  const init = load()
  return {
    baseURL: init.baseURL,
    token: init.token,
    set: (baseURL, token) => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ baseURL, token })) } catch { /* ignore */ }
      set({ baseURL, token })
    },
  }
})
