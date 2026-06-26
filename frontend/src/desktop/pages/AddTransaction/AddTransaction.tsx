import { useState, useRef, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Flex,
  Heading,
  Text,
  Button,
  TextField,
  Card,
  Badge,
  IconButton,
} from '@radix-ui/themes'
import { Sparkles, Check, Camera } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../../utils/api.ts'
import { extractTextFromImage, cleanOcrText } from '../../../utils/ocr.ts'
import styles from './AddTransaction.module.css'

interface ParsedResult {
  amount: number | null
  description: string
  type: string
  category: string | null
}

export const AddTransaction = (): JSX.Element => {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [parsed, setParsed] = useState<ParsedResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)

  const handleParse = async () => {
    if (!input.trim()) return
    setLoading(true)
    try {
      const response = await api.post('/api/transactions/parse', { text: input })
      setParsed(response.data)
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Could not parse that text')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!parsed) return
    setSaving(true)
    try {
      await api.post('/api/transactions/quick-add', { text: input })
      toast.success('Transaction added!')
      navigate('/')
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save transaction')
    } finally {
      setSaving(false)
    }
  }

  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true)
    try {
      const raw = await extractTextFromImage(file)
      const cleaned = cleanOcrText(raw)
      if (cleaned) {
        setInput(cleaned)
        setParsed(null)
        toast.success('Receipt scanned! Review and parse the text.')
      } else {
        toast.error('Could not read any text from the image')
      }
    } catch {
      toast.error('Failed to scan receipt')
    } finally {
      setScanning(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <Box className={styles.page}>
      <Heading size="6" mb="6">
        Quick Add
      </Heading>

      <Card size="3" className={styles.card}>
        <Flex direction="column" gap="4">
          <Flex direction="column" gap="2">
            <Text size="2" weight="medium">
              Describe your transaction
            </Text>
            <TextField.Root
              className={styles.input}
              placeholder="spent 15 on groceries"
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                setParsed(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleParse()
              }}
            >
              <TextField.Slot side="left">
                <Sparkles size={16} />
              </TextField.Slot>
              <TextField.Slot side="right">
                <IconButton
                  variant="ghost"
                  size="2"
                  onClick={() => fileInputRef.current?.click()}
                  loading={scanning}
                  aria-label="Scan receipt"
                >
                  <Camera size={16} />
                </IconButton>
              </TextField.Slot>
            </TextField.Root>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileScan}
            />
            <Text size="1" color="gray">
              Try: &ldquo;spent 15 on groceries&rdquo;, &ldquo;uber 15&rdquo;, &ldquo;salary
              5000&rdquo;
            </Text>
          </Flex>

          <Flex gap="3">
            <Button onClick={handleParse} loading={loading} size="3">
              {parsed ? 'Re-parse' : 'Parse'}
            </Button>
            {parsed && (
              <Button onClick={handleSave} loading={saving} size="3">
                <Check size={16} /> Confirm & save
              </Button>
            )}
          </Flex>

          {parsed && (
            <Flex direction="column" gap="3" className={styles.preview}>
              <Flex align="center" justify="between">
                <Text weight="bold" size="3">
                  {parsed.description}
                </Text>
                <Text weight="bold" size="4">
                  ${parsed.amount?.toFixed(2)}
                </Text>
              </Flex>

              <Flex gap="2">
                <Badge color={parsed.type === 'income' ? 'green' : 'orange'}>{parsed.type}</Badge>
                {parsed.category && <Badge color="gray">{parsed.category}</Badge>}
              </Flex>
            </Flex>
          )}
        </Flex>
      </Card>
    </Box>
  )
}
