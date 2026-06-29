import { useState, useRef, type JSX } from 'react'
import { Flex, Text, Button, TextField, Card, Badge, IconButton, Dialog } from '@radix-ui/themes'
import { Sparkles, Check, Camera, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useShallow } from 'zustand/react/shallow'
import { useBoundStore } from '../../../store/useBoundStore.ts'
import api from '../../../auth/api.ts'
import { extractTextFromImage, cleanOcrText } from '../../../utils/ocr.ts'

interface ParsedResult {
  amount: number | null
  description: string
  type: string
  category: string | null
}

export const AddTransactionModal = (): JSX.Element => {
  const { addModalOpen, closeAddModal } = useBoundStore(
    useShallow((s) => ({
      addModalOpen: s.ui.addModalOpen,
      closeAddModal: s.closeAddModal,
    })),
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [parsed, setParsed] = useState<ParsedResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)

  const reset = () => {
    setInput('')
    setParsed(null)
    setLoading(false)
    setSaving(false)
    setScanning(false)
  }

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
      reset()
      closeAddModal()
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
    <Dialog.Root
      open={addModalOpen}
      onOpenChange={(open) => {
        if (!open) {
          reset()
          closeAddModal()
        }
      }}
    >
      <Dialog.Content aria-describedby={undefined}>
        <Flex align="center" justify="between" mb="4">
          <Dialog.Title>Quick Add</Dialog.Title>
          <IconButton
            variant="ghost"
            size="2"
            onClick={() => {
              reset()
              closeAddModal()
            }}
            aria-label="Close"
          >
            <X size={20} />
          </IconButton>
        </Flex>

        <Flex direction="column" gap="4">
          <Flex direction="column" gap="2">
            <Text size="2" weight="medium">
              Describe your transaction
            </Text>
            <TextField.Root
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
            <Card size="3">
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
              </Flex>
            </Card>
          )}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
