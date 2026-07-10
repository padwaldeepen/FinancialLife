import { useState, useRef, useEffect, type JSX } from 'react'
import { Text, Button, TextField } from '@radix-ui/themes'
import { MessageCircle, X, Send, Bot, User, Check } from 'lucide-react'
import api from '../../../auth/api.ts'
import styles from './ChatBot.module.css'

interface ChatMsg {
  role: 'user' | 'assistant'
  text: string
  transactionData?: {
    amount: number
    description: string
    type: string
    category: string
    merchant?: string
  }
}

export const ChatBot = (): JSX.Element => {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: 'assistant',
      text: "Hi! I'm your financial assistant. You can:\n- Log transactions: 'spent 15 on coffee'\n- Ask questions: 'how much did I spend on food this month?'",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text }])
    setLoading(true)

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
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.reply,
          transactionData: data.transaction_data || undefined,
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Sorry, something went wrong. Please try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleSaveTransaction = async (txData: NonNullable<ChatMsg['transactionData']>) => {
    try {
      await api.post('/api/transactions/', {
        amount: txData.amount,
        description: txData.description,
        transaction_type: txData.type,
        category: txData.category,
        merchant: txData.merchant || txData.description,
        date: new Date().toISOString(),
        account_id: 1,
      })
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Saved! $${txData.amount.toFixed(2)} ${txData.description} logged.`,
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Failed to save transaction. Please try again.' },
      ])
    }
  }

  return (
    <div className={styles.container}>
      {open && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <Bot size={18} />
            <span className={styles.headerTitle}>Assistant</span>
            <button className={styles.closeBtn} onClick={() => setOpen(false)} type="button">
              <X size={16} />
            </button>
          </div>

          <div className={styles.messages} ref={scrollRef}>
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`${styles.message} ${msg.role === 'user' ? styles.userMsg : styles.botMsg}`}
              >
                <div className={styles.msgIcon}>
                  {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                </div>
                <div className={styles.msgContent}>
                  <div className={styles.msgBubble}>
                    {msg.text.split('\n').map((line, j) => (
                      <Text key={j} size="2" as="div">
                        {line}
                      </Text>
                    ))}
                  </div>
                  {msg.transactionData && (
                    <div className={styles.txPreview}>
                      <div className={styles.txInfo}>
                        <Text size="1" color="gray">
                          Transaction detected
                        </Text>
                        <Text size="2" weight="medium">
                          {msg.transactionData.description} — $
                          {msg.transactionData.amount.toFixed(2)}
                        </Text>
                        <Text size="1" color="gray">
                          {msg.transactionData.type} · {msg.transactionData.category}
                        </Text>
                      </div>
                      <Button size="1" onClick={() => handleSaveTransaction(msg.transactionData!)}>
                        <Check size={12} />
                        Save
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className={`${styles.message} ${styles.botMsg}`}>
                <div className={styles.msgIcon}>
                  <Bot size={14} />
                </div>
                <div className={styles.msgContent}>
                  <div className={styles.msgBubble}>
                    <Text size="2" color="gray">
                      Thinking...
                    </Text>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={styles.inputArea}>
            <TextField.Root
              placeholder="Ask anything or log a transaction..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              className={styles.input}
            >
              <TextField.Slot side="right">
                <button
                  className={styles.sendBtn}
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  type="button"
                >
                  <Send size={16} />
                </button>
              </TextField.Slot>
            </TextField.Root>
          </div>
        </div>
      )}

      <button
        className={`${styles.fab} ${open ? styles.fabOpen : ''}`}
        onClick={() => setOpen(!open)}
        type="button"
        aria-label="Chat assistant"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  )
}
