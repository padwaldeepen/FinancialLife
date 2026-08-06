import { useRef, useEffect, type JSX } from 'react'
import { Box, Flex, Text, Button, IconButton, TextField } from '@radix-ui/themes'
import { MessageCircle, X, Send, Bot, User, Check } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import { useActiveCurrency } from '../../../shared/hooks/useActiveCurrency.ts'
import { formatCurrency } from '../../../shared/utils/format.ts'
import type { ChatMsg } from '../../../store/slices/chatSlice.ts'
import styles from './ChatBot.module.css'

export const ChatBot = (): JSX.Element => {
  const currency = useActiveCurrency()
  const {
    open,
    messages,
    input,
    loading,
    setChatOpen,
    toggleChatOpen,
    setChatInput,
    sendChatMessage,
    saveChatTransaction,
  } = useBoundStore(
    useShallow((s) => ({
      open: s.chat.open,
      messages: s.chat.messages,
      input: s.chat.input,
      loading: s.chat.loading,
      setChatOpen: s.chat.setChatOpen,
      toggleChatOpen: s.chat.toggleChatOpen,
      setChatInput: s.chat.setChatInput,
      sendChatMessage: s.chat.sendChatMessage,
      saveChatTransaction: s.chat.saveChatTransaction,
    })),
  )
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleSaveTransaction = (txData: NonNullable<ChatMsg['transactionData']>) => {
    saveChatTransaction(txData, currency)
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
              onClick={() => setChatOpen(false)}
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
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendChatMessage()
                }
              }}
              className={styles.input}
            >
              <TextField.Slot side="right">
                <IconButton
                  size="1"
                  variant="ghost"
                  onClick={sendChatMessage}
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
        onClick={toggleChatOpen}
        aria-label={open ? 'Close chat' : 'Open chat assistant'}
        aria-expanded={open}
        size="3"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </IconButton>
    </Box>
  )
}
