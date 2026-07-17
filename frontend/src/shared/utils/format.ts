export const formatCurrency = (amount: number): string => {
  const formatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  // Negative money must LOOK negative — hiding the sign turns debt into assets
  return amount < 0 ? `-$${formatted}` : `$${formatted}`
}

export const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const formatDateFull = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export const getAmountColor = (type: string): string => {
  return type === 'income' ? 'var(--green-11)' : 'var(--red-11)'
}
