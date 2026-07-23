import { namespaceSlice, isFresh } from '../namespaceSlice.ts'
import api from '../../shared/api/client.ts'
import toast from '../../shared/utils/toast.ts'

export interface AdviceCard {
  type: string
  message: string
  evidence: Record<string, unknown>
  ai_generated: boolean
}

export type AdviceSlice = {
  advice: {
    cards: AdviceCard[]
    loading: boolean
    lastFetchedAt: number | null
  }
  fetchAdvice: (opts?: { force?: boolean }) => Promise<void>
  dismissAdviceType: (type: string) => Promise<void>
}

export const createAdviceSlice = namespaceSlice('advice', (set, get) => ({
  cards: [] as AdviceCard[],
  loading: true,
  lastFetchedAt: null as number | null,

  fetchAdvice: async (opts?: { force?: boolean }) => {
    if (!opts?.force && isFresh(get().lastFetchedAt)) return
    set({ loading: true })
    try {
      const res = await api.get('/api/insights/advice')
      set({ cards: res.data, lastFetchedAt: Date.now() })
    } finally {
      set({ loading: false })
    }
  },

  dismissAdviceType: async (type: string) => {
    const cards: AdviceCard[] = get().cards
    set({ cards: cards.filter((c) => c.type !== type) })
    try {
      await api.post('/api/insights/advice/dismiss', { type })
    } catch {
      set({ cards })
      toast.error('Failed to dismiss')
    }
  },
}))
