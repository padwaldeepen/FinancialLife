import { type JSX } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Heading, Text, Flex } from '@radix-ui/themes'
import { ProtectedRoute } from '../shared/components/ProtectedRoute/ProtectedRoute.tsx'
import { MobileLayout } from './layouts/MobileLayout.tsx'
import { Login } from './pages/Login/Login.tsx'
import { Register } from './pages/Register/Register.tsx'
import { Activity } from './pages/Activity/Activity.tsx'
import { Home } from './pages/Home/Home.tsx'
import { Budgets } from './pages/Budgets/Budgets.tsx'
import { Bills } from './pages/Bills/Bills.tsx'

const PlaceholderPage = ({ title }: { title: string }) => (
  <Flex direction="column" gap="4" pt="4">
    <Heading size="5">{title}</Heading>
    <Text color="gray">This page will be implemented in a later phase.</Text>
  </Flex>
)

export const MobileApp = (): JSX.Element => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<MobileLayout />}>
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
              <Bills />
            </ProtectedRoute>
          }
        />
        <Route
          path="/more"
          element={
            <ProtectedRoute>
              <PlaceholderPage title="More" />
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
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <PlaceholderPage title="Profile" />
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
