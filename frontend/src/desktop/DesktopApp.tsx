import { type JSX } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Heading, Text, Flex } from '@radix-ui/themes'
import { ProtectedRoute } from '../shared/components/ProtectedRoute/ProtectedRoute.tsx'
import { DesktopLayout } from './layouts/DesktopLayout.tsx'
import { Login } from './pages/Login/Login.tsx'
import { Register } from './pages/Register/Register.tsx'
import { Activity } from './pages/Activity/Activity.tsx'
import { Home } from './pages/Home/Home.tsx'
import { Budgets } from './pages/Budgets/Budgets.tsx'

const PlaceholderPage = ({ title }: { title: string }) => (
  <Flex direction="column" gap="4">
    <Heading size="6">{title}</Heading>
    <Text color="gray">This page will be implemented in a later phase.</Text>
  </Flex>
)

export const DesktopApp = (): JSX.Element => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<DesktopLayout />}>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/activity"
          element={
            <ProtectedRoute>
              <Activity />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bills"
          element={
            <ProtectedRoute>
              <PlaceholderPage title="Bills" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/merchants"
          element={
            <ProtectedRoute>
              <PlaceholderPage title="Merchants" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/categories"
          element={
            <ProtectedRoute>
              <PlaceholderPage title="Categories" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/goals"
          element={
            <ProtectedRoute>
              <PlaceholderPage title="Goals" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <PlaceholderPage title="Reports" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <PlaceholderPage title="Settings" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/budgets"
          element={
            <ProtectedRoute>
              <Budgets />
            </ProtectedRoute>
          }
        />
        <Route path="/transactions" element={<Navigate to="/activity" replace />} />
        <Route path="/add" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Route>
    </Routes>
  )
}
