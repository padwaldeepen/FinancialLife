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
import { ArrowLeft, Sparkles, Check, Camera } from 'lucide-react'
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
        toast.success('Receipt scanned! Review the text.')
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
      <Flex align="center" gap="3" mb="4">
        <IconButton variant="ghost" size="2" onClick={() => navigate(-1)} aria-label="Go back">
          <ArrowLeft size={20} />
        </IconButton>
        <Heading size="5">Quick Add</Heading>
      </Flex>

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
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleFileScan}
          />
          <Text size="1" color="gray">
            Try typing or scan a receipt
          </Text>
        </Flex>

        <Button onClick={handleParse} loading={loading} size="3">
          {parsed ? 'Re-parse' : 'Parse'}
        </Button>

        {parsed && (
          <Card size="2">
            <Flex direction="column" gap="3">
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

              <Button onClick={handleSave} loading={saving} size="3">
                <Check size={16} /> Confirm & save
              </Button>
            </Flex>
          </Card>
        )}
      </Flex>
    </Box>
  )
}
