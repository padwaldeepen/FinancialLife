import { type JSX } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '../shared/components/ProtectedRoute/ProtectedRoute.tsx'
import { DesktopLayout } from './layouts/DesktopLayout.tsx'
import { Login } from '../shared/pages/Login/Login.tsx'
import { Register } from '../shared/pages/Register/Register.tsx'
import { Activity } from './pages/Activity/Activity.tsx'
import { Home } from './pages/Home/Home.tsx'
import { Insights } from './pages/Insights/Insights.tsx'
import { Recurring } from './pages/Recurring/Recurring.tsx'
import { Manage } from './pages/Manage/Manage.tsx'

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
          path="/recurring"
          element={
            <ProtectedRoute>
              <Recurring />
            </ProtectedRoute>
          }
        />
        <Route path="/bills" element={<Navigate to="/recurring" replace />} />
        <Route path="/bills/:id" element={<Navigate to="/recurring" replace />} />
        <Route
          path="/manage"
          element={
            <ProtectedRoute>
              <Manage />
            </ProtectedRoute>
          }
        />
        <Route path="/merchants" element={<Navigate to="/manage" replace />} />
        <Route path="/categories" element={<Navigate to="/manage" replace />} />
        <Route path="/goals" element={<Navigate to="/manage" replace />} />
        <Route path="/settings" element={<Navigate to="/manage" replace />} />
        <Route
          path="/insights"
          element={
            <ProtectedRoute>
              <Insights />
            </ProtectedRoute>
          }
        />
        <Route path="/reports" element={<Navigate to="/insights" replace />} />
        <Route path="/transactions" element={<Navigate to="/activity" replace />} />
        <Route path="/add" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
