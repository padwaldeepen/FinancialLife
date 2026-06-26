import { useState } from 'react'
import { Plus, Target, Calendar } from 'lucide-react'

interface Budget {
  id: number
  name: string
  amount: number
  spent: number
  period: string
  category: string
  startDate: string
  endDate: string
  isActive: boolean
}

const Budgets: React.FC = () => {
  const [showAddModal, setShowAddModal] = useState(false)

  // Mock data - replace with API calls
  const budgets: Budget[] = [
    {
      id: 1,
      name: 'Monthly Groceries',
      amount: 500,
      spent: 320,
      period: 'monthly',
      category: 'Food & Dining',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      isActive: true,
    },
    {
      id: 2,
      name: 'Entertainment',
      amount: 200,
      spent: 150,
      period: 'monthly',
      category: 'Entertainment',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      isActive: true,
    },
    {
      id: 3,
      name: 'Transportation',
      amount: 300,
      spent: 280,
      period: 'monthly',
      category: 'Transportation',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      isActive: true,
    },
  ]

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getProgressPercentage = (spent: number, amount: number) => {
    return Math.min((spent / amount) * 100, 100)
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 75) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getRemainingDays = (endDate: string) => {
    const end = new Date(endDate)
    const today = new Date()
    const diffTime = end.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays > 0 ? diffDays : 0
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Budgets</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus size={16} />
          <span>Create Budget</span>
        </button>
      </div>

      {/* Budget Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
              <Target className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                Total Budget
              </p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {formatCurrency(budgets.reduce((sum, budget) => sum + budget.amount, 0))}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-secondary-100 dark:bg-secondary-900 rounded-lg">
              <Calendar className="h-6 w-6 text-secondary-600 dark:text-secondary-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                Total Spent
              </p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {formatCurrency(budgets.reduce((sum, budget) => sum + budget.spent, 0))}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-accent-100 dark:bg-accent-900 rounded-lg">
              <Target className="h-6 w-6 text-accent-600 dark:text-accent-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                Remaining
              </p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                {formatCurrency(
                  budgets.reduce((sum, budget) => sum + budget.amount, 0) -
                    budgets.reduce((sum, budget) => sum + budget.spent, 0),
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Budgets List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {budgets.map((budget) => {
          const progressPercentage = getProgressPercentage(budget.spent, budget.amount)
          const progressColor = getProgressColor(progressPercentage)
          const remainingDays = getRemainingDays(budget.endDate)

          return (
            <div key={budget.id} className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    {budget.name}
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {budget.category}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    budget.isActive
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200'
                  }`}
                >
                  {budget.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">
                    {formatCurrency(budget.spent)} of {formatCurrency(budget.amount)}
                  </span>
                  <span className="text-neutral-900 dark:text-neutral-100 font-medium">
                    {progressPercentage.toFixed(1)}%
                  </span>
                </div>

                <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${progressColor}`}
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>

                <div className="flex justify-between text-sm text-neutral-600 dark:text-neutral-400">
                  <span>{formatCurrency(budget.amount - budget.spent)} remaining</span>
                  <span>{remainingDays} days left</span>
                </div>

                <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
                  <span>Start: {formatDate(budget.startDate)}</span>
                  <span>End: {formatDate(budget.endDate)}</span>
                </div>
              </div>

              <div className="mt-4 flex justify-end space-x-2">
                <button className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 text-sm">
                  Edit
                </button>
                <button className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 text-sm">
                  Delete
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {budgets.length === 0 && (
        <div className="card text-center py-12">
          <Target className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
            No budgets yet
          </h3>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
            Create your first budget to start tracking your spending goals.
          </p>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            Create Budget
          </button>
        </div>
      )}

      {/* Add Budget Modal - Placeholder */}
      {showAddModal && (
        <div className="fixed inset-0 bg-neutral-900 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              Create Budget
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">
              Budget form coming soon...
            </p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setShowAddModal(false)} className="btn-outline">
                Cancel
              </button>
              <button onClick={() => setShowAddModal(false)} className="btn-primary">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Budgets
