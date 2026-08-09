import { namespaceSlice, isFresh } from '../namespaceSlice.ts'
import api from '../../shared/api/client.ts'
import toast from '../../shared/utils/toast.ts'

export interface AdviceCard {
  type: string
  message: string
  evidence: Record<string, unknown>
  ai_generated: boolean
}

// Y3. Same shape family as AdviceCard — deliberately, since both render through the
// same evidence + dismiss card and share the dismissed_insight_types table server-side.
export interface AttentionItem {
  type: string
  severity: 'urgent' | 'warning' | 'info'
  message: string
  evidence: Record<string, unknown>
  action_path: string | null
}

export type AdviceSlice = {
  advice: {
    cards: AdviceCard[]
    loading: boolean
    lastFetchedAt: number | null
    fetchAdvice: (opts?: { force?: boolean }) => Promise<void>
    dismissAdviceType: (type: string) => Promise<void>
    attention: AttentionItem[]
    attentionFetchedAt: number | null
    fetchAttention: (opts?: { force?: boolean }) => Promise<void>
    dismissAttention: (type: string) => Promise<void>
  }
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

  attention: [] as AttentionItem[],
  attentionFetchedAt: null as number | null,

  fetchAttention: async (opts?: { force?: boolean }) => {
    if (!opts?.force && isFresh(get().attentionFetchedAt)) return
    try {
      const res = await api.get('/api/insights/needs-attention')
      set({ attention: res.data as AttentionItem[], attentionFetchedAt: Date.now() })
    } catch {
      // Home must still render if this fails — it's an addition to the page, not the page.
      set({ attention: [] })
    }
  },

  // Optimistic: the item disappears immediately, and comes back if the server refuses.
  // Dismissal is by *type*, so it stays dismissed on the next fetch too.
  dismissAttention: async (type: string) => {
    const previous: AttentionItem[] = get().attention
    set({ attention: previous.filter((a) => a.type !== type) })
    try {
      await api.post('/api/insights/advice/dismiss', { type })
    } catch {
      set({ attention: previous })
      toast.error('Failed to dismiss')
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
