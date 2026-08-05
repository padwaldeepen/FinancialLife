import { useState, useRef, useEffect, type JSX } from 'react'
import { Box, Flex, Text, Button, IconButton, TextField } from '@radix-ui/themes'
import { MessageCircle, X, Send, Bot, User, Check } from 'lucide-react'
import api from '../../../shared/api/client.ts'
import { useActiveCurrency } from '../../../shared/hooks/useActiveCurrency.ts'
import { formatCurrency } from '../../../shared/utils/format.ts'
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
    // The original user text this preview was parsed from — Save resends this
    // through /transactions/quick-add so the server (not the client) resolves the
    // profile's default account and re-parses category/merchant, the same path the
    // Quick Add modal uses. Never construct a raw insert here.
    sourceText: string
  }
}

export const ChatBot = (): JSX.Element => {
  const currency = useActiveCurrency()
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
          transactionData: data.transaction_data
            ? { ...data.transaction_data, sourceText: text }
            : undefined,
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
      // Same path the Quick Add modal uses — the server re-parses `sourceText` and
      // picks the active profile's default account; this component never chooses an
      // account or currency itself (that was the R1 bug: a hardcoded account_id=1
      // and a hardcoded "$" broke IN/CA profiles).
      await api.post('/api/transactions/quick-add', { text: txData.sourceText })
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Saved! ${formatCurrency(txData.amount, currency)} ${txData.description} logged.`,
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
    <Box className={styles.container}>
      {open && (
        <Flex
          direction="column"
          className={styles.panel}
          role="dialog"
          aria-modal="true"
          aria-label="Chat assistant"
        >
          <Flex align="center" gap="2" className={styles.header}>
            <Bot size={18} />
            <Text size="2" weight="medium" className={styles.headerTitle}>
              Assistant
            </Text>
            <IconButton
              size="1"
              variant="ghost"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              <X size={16} />
            </IconButton>
          </Flex>

          <Box className={styles.messages} ref={scrollRef}>
            {messages.map((msg, i) => (
              <Flex
                key={i}
                gap="2"
                direction="column"
                className={`${styles.message} ${msg.role === 'user' ? styles.userMsg : styles.botMsg}`}
              >
                <Flex gap="2" align="start">
                  <Box className={styles.msgIcon}>
                    {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                  </Box>
                  <Flex direction="column" gap="1" className={styles.msgContent}>
                    <Box className={styles.msgBubble}>
                      {msg.text.split('\n').map((line, j) => (
                        <Text key={j} size="2" as="div">
                          {line}
                        </Text>
                      ))}
                    </Box>
                    {msg.transactionData && (
                      <Flex direction="column" gap="1" className={styles.txPreview}>
                        <Flex direction="column" gap="1">
                          <Text size="1" color="gray">
                            Transaction detected
                          </Text>
                          <Text size="2" weight="medium">
                            {msg.transactionData.description} —{' '}
                            {formatCurrency(msg.transactionData.amount, currency)}
                          </Text>
                          <Text size="1" color="gray">
                            {msg.transactionData.type} · {msg.transactionData.category}
                          </Text>
                        </Flex>
                        <Button
                          size="1"
                          onClick={() => handleSaveTransaction(msg.transactionData!)}
                        >
                          <Check size={12} />
                          Save
                        </Button>
                      </Flex>
                    )}
                  </Flex>
                </Flex>
              </Flex>
            ))}
            {loading && (
              <Flex gap="2" direction="column" className={`${styles.message} ${styles.botMsg}`}>
                <Flex gap="2" align="start">
                  <Box className={styles.msgIcon}>
                    <Bot size={14} />
                  </Box>
                  <Box className={styles.msgContent}>
                    <Box className={styles.msgBubble}>
                      <Text size="2" color="gray">
                        Thinking...
                      </Text>
                    </Box>
                  </Box>
                </Flex>
              </Flex>
            )}
          </Box>

          <Box className={styles.inputArea}>
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
                <IconButton
                  size="1"
                  variant="ghost"
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  aria-label="Send message"
                >
                  <Send size={16} />
                </IconButton>
              </TextField.Slot>
            </TextField.Root>
          </Box>
        </Flex>
      )}

      <IconButton
        className={`${styles.fab} ${open ? styles.fabOpen : ''}`}
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Close chat' : 'Open chat assistant'}
        aria-expanded={open}
        size="3"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </IconButton>
    </Box>
  )
}
