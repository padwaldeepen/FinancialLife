import { namespaceSlice } from '../namespaceSlice.ts'
import api from '../../shared/api/client.ts'
import { formatCurrency } from '../../shared/utils/format.ts'
import { refreshAfterMoneyChange } from '../refreshAfterMoneyChange.ts'

export interface ChatMsg {
  role: 'user' | 'assistant'
  text: string
  transactionData?: {
    amount: number
    description: string
    type: string
    category: string
    merchant?: string
    // The original user text this preview was parsed from — Save resends this
    // through /transactions/quick-add so the server (not the client) resolves the
    // profile's default account and re-parses category/merchant, the same path the
    // Quick Add modal uses. Never construct a raw insert here.
    sourceText: string
  }
}

const greeting: ChatMsg = {
  role: 'assistant',
  text: "Hi! I'm your financial assistant. You can:\n- Log transactions: 'spent 15 on coffee'\n- Ask questions: 'how much did I spend on food this month?'",
}

export interface ChatState {
  open: boolean
  messages: ChatMsg[]
  input: string
  loading: boolean
}

export interface ChatActions {
  setChatOpen: (open: boolean) => void
  toggleChatOpen: () => void
  setChatInput: (input: string) => void
  sendChatMessage: () => Promise<void>
  saveChatTransaction: (
    txData: NonNullable<ChatMsg['transactionData']>,
    currency: string,
  ) => Promise<void>
}

export type ChatSlice = {
  chat: ChatState & ChatActions
}

export const createChatSlice = namespaceSlice('chat', (set, get) => ({
  open: false,
  messages: [greeting] as ChatMsg[],
  input: '',
  loading: false,

  setChatOpen: (open: boolean) => set({ open }),
  toggleChatOpen: () => set({ open: !get().open }),
  setChatInput: (input: string) => set({ input }),

  sendChatMessage: async () => {
    const text = get().input.trim()
    if (!text || get().loading) return

    set({ input: '', messages: [...get().messages, { role: 'user', text }], loading: true })

    try {
      const res = await api.post('/api/chat/', { message: text })
      const data = res.data as {
        reply: string
        transaction_created: boolean
        transaction_data: {
          amount: number
          description: string
          type: string
          category: string
          merchant?: string
        } | null
      }
      set({
        messages: [
          ...get().messages,
          {
            role: 'assistant',
            text: data.reply,
            transactionData: data.transaction_data
              ? { ...data.transaction_data, sourceText: text }
              : undefined,
          },
        ],
      })
    } catch {
      set({
        messages: [
          ...get().messages,
          { role: 'assistant', text: 'Sorry, something went wrong. Please try again.' },
        ],
      })
    } finally {
      set({ loading: false })
    }
  },

  saveChatTransaction: async (
    txData: NonNullable<ChatMsg['transactionData']>,
    currency: string,
  ) => {
    try {
      // Same path the Quick Add modal uses — the server re-parses `sourceText` and
      // picks the active profile's default account; this component never chooses an
      // account or currency itself (that was the R1 bug: a hardcoded account_id=1
      // and a hardcoded "$" broke IN/CA profiles).
      await api.post('/api/transactions/quick-add', { text: txData.sourceText })
      // The chat can create real money, so it owes the same refresh every other write
      // path does — this was the one money-write site that never adopted it, leaving
      // balances and Activity stale until an unrelated navigation happened to refetch.
      refreshAfterMoneyChange()
      set({
        messages: [
          ...get().messages,
          {
            role: 'assistant',
            text: `Saved! ${formatCurrency(txData.amount, currency)} ${txData.description} logged.`,
          },
        ],
      })
    } catch {
      set({
        messages: [
          ...get().messages,
          { role: 'assistant', text: 'Failed to save transaction. Please try again.' },
        ],
      })
    }
  },
}))
