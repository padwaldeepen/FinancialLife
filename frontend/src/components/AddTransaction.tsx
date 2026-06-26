import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { X, Sparkles, Calendar, DollarSign, FileText, Tag } from 'lucide-react'
import api from '../utils/api'
import toast from 'react-hot-toast'

interface AddTransactionProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface TransactionForm {
  description: string
  amount: number
  transaction_type: 'income' | 'expense'
  category_id?: number
  date: string
  notes?: string
}

interface Category {
  id: number
  name: string
  color: string
}

interface AICategorization {
  suggested_category: string
  confidence: number
  extracted_amount?: number
  extracted_date?: string
  transaction_type: 'income' | 'expense'
}

const AddTransaction: React.FC<AddTransactionProps> = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState<'manual' | 'ai'>('manual')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<AICategorization | null>(null)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<TransactionForm>()

  const watchedDescription = watch('description')

  // Mock categories - in real app, fetch from API
  const mockCategories: Category[] = [
    { id: 1, name: 'Food & Dining', color: '#FF6B6B' },
    { id: 2, name: 'Transportation', color: '#4ECDC4' },
    { id: 3, name: 'Shopping', color: '#45B7D1' },
    { id: 4, name: 'Entertainment', color: '#96CEB4' },
    { id: 5, name: 'Healthcare', color: '#FFEAA7' },
    { id: 6, name: 'Utilities', color: '#DDA0DD' },
    { id: 7, name: 'Housing', color: '#98D8C8' },
    { id: 8, name: 'Education', color: '#F7DC6F' },
    { id: 9, name: 'Travel', color: '#BB8FCE' },
    { id: 10, name: 'Salary', color: '#82E0AA' },
    { id: 11, name: 'Freelance', color: '#F8C471' },
    { id: 12, name: 'Investment', color: '#85C1E9' },
  ]

  const handleAICategorization = async () => {
    if (!watchedDescription.trim()) {
      toast.error('Please enter a description for AI categorization')
      return
    }

    setAiLoading(true)
    try {
      const response = await api.post('/api/ai/categorize', {
        description: watchedDescription,
        amount: watch('amount'),
        date: watch('date'),
      })

      setAiResult(response.data)

      // Auto-fill form with AI suggestions
      setValue('transaction_type', response.data.transaction_type)
      if (response.data.extracted_amount) {
        setValue('amount', response.data.extracted_amount)
      }
      if (response.data.extracted_date) {
        setValue('date', response.data.extracted_date)
      }

      toast.success(
        `AI categorized as: ${response.data.suggested_category} (${(response.data.confidence * 100).toFixed(0)}% confidence)`,
      )
    } catch (error: any) {
      console.error('AI categorization failed:', error)
      toast.error(error.response?.data?.detail || 'AI categorization failed')
    } finally {
      setAiLoading(false)
    }
  }

  const onSubmit = async (data: TransactionForm) => {
    setLoading(true)
    try {
      await api.post('/api/transactions/', {
        ...data,
        date: new Date(data.date).toISOString(),
      })

      toast.success('Transaction added successfully!')
      reset()
      setAiResult(null)
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Failed to add transaction:', error)
      toast.error(error.response?.data?.detail || 'Failed to add transaction')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    reset()
    setAiResult(null)
    setMode('manual')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-neutral-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              Add Transaction
            </h3>
            <button
              onClick={handleClose}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              <X size={24} />
            </button>
          </div>

          {/* Mode Toggle */}
          <div className="flex mb-6 bg-neutral-100 dark:bg-neutral-700 rounded-lg p-1">
            <button
              onClick={() => setMode('manual')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                mode === 'manual'
                  ? 'bg-white dark:bg-neutral-600 text-neutral-900 dark:text-neutral-100 shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              Manual Entry
            </button>
            <button
              onClick={() => setMode('ai')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                mode === 'ai'
                  ? 'bg-white dark:bg-neutral-600 text-neutral-900 dark:text-neutral-100 shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              <Sparkles size={16} className="inline mr-2" />
              AI Mode
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Description
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FileText className="h-5 w-5 text-neutral-400" />
                </div>
                <input
                  {...register('description', { required: 'Description is required' })}
                  type="text"
                  className="input-field pl-10"
                  placeholder="e.g., Grocery shopping at Walmart"
                />
              </div>
              {errors.description && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.description.message}
                </p>
              )}
            </div>

            {/* AI Mode Features */}
            {mode === 'ai' && (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={handleAICategorization}
                  disabled={aiLoading || !watchedDescription.trim()}
                  className="btn-secondary w-full flex items-center justify-center space-x-2"
                >
                  <Sparkles size={16} />
                  <span>{aiLoading ? 'Analyzing...' : 'Analyze with AI'}</span>
                </button>

                {aiResult && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <Sparkles size={16} className="text-green-600 dark:text-green-400" />
                      <span className="font-medium text-green-800 dark:text-green-200">
                        AI Suggestion
                      </span>
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-300">
                      <p>
                        <strong>Category:</strong> {aiResult.suggested_category}
                      </p>
                      <p>
                        <strong>Type:</strong> {aiResult.transaction_type}
                      </p>
                      <p>
                        <strong>Confidence:</strong> {(aiResult.confidence * 100).toFixed(0)}%
                      </p>
                      {aiResult.extracted_amount && (
                        <p>
                          <strong>Extracted Amount:</strong> ${aiResult.extracted_amount}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Amount
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="h-5 w-5 text-neutral-400" />
                </div>
                <input
                  {...register('amount', {
                    required: 'Amount is required',
                    min: { value: 0.01, message: 'Amount must be greater than 0' },
                  })}
                  type="number"
                  step="0.01"
                  className="input-field pl-10"
                  placeholder="0.00"
                />
              </div>
              {errors.amount && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.amount.message}
                </p>
              )}
            </div>

            {/* Transaction Type */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Type
              </label>
              <select
                {...register('transaction_type', { required: 'Transaction type is required' })}
                className="input-field"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
              {errors.transaction_type && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.transaction_type.message}
                </p>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Category
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Tag className="h-5 w-5 text-neutral-400" />
                </div>
                <select {...register('category_id')} className="input-field pl-10">
                  <option value="">Select a category</option>
                  {mockCategories
                    .filter((cat) => {
                      const type = watch('transaction_type')
                      if (type === 'income') {
                        return [
                          'Salary',
                          'Freelance',
                          'Investment',
                          'Business',
                          'Gift',
                          'Refund',
                          'Other',
                        ].includes(cat.name)
                      } else {
                        return ![
                          'Salary',
                          'Freelance',
                          'Investment',
                          'Business',
                          'Gift',
                          'Refund',
                        ].includes(cat.name)
                      }
                    })
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Date
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-neutral-400" />
                </div>
                <input
                  {...register('date', { required: 'Date is required' })}
                  type="date"
                  className="input-field pl-10"
                  defaultValue={new Date().toISOString().split('T')[0]}
                />
              </div>
              {errors.date && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.date.message}</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Notes (Optional)
              </label>
              <textarea
                {...register('notes')}
                rows={3}
                className="input-field"
                placeholder="Add any additional notes..."
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={handleClose} className="btn-outline">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? 'Adding...' : 'Add Transaction'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default AddTransaction
