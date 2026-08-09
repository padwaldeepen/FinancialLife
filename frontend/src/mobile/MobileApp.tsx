import { type JSX } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '../shared/components/ProtectedRoute/ProtectedRoute.tsx'
import { MobileLayout } from './layouts/MobileLayout.tsx'
import { Login } from '../shared/pages/Login/Login.tsx'
import { Register } from '../shared/pages/Register/Register.tsx'
import { Activity } from './pages/Activity/Activity.tsx'
import { Home } from './pages/Home/Home.tsx'
import { Settings } from './pages/Settings/Settings.tsx'

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
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        {/* U8: mobile = Home/Activity/Capture, nothing else — Bills/Goals/Categories/
            Merchants/Reports/More all retired, old bookmarks land back on Home. */}
        <Route path="/bills" element={<Navigate to="/" replace />} />
        <Route path="/bills/:id" element={<Navigate to="/" replace />} />
        <Route path="/goals" element={<Navigate to="/" replace />} />
        <Route path="/categories" element={<Navigate to="/" replace />} />
        <Route path="/merchants" element={<Navigate to="/" replace />} />
        <Route path="/reports" element={<Navigate to="/" replace />} />
        <Route path="/more" element={<Navigate to="/" replace />} />
        <Route path="/profile" element={<Navigate to="/settings" replace />} />
        <Route path="/transactions" element={<Navigate to="/activity" replace />} />
        <Route path="/add" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
