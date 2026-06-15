import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './components/DashboardLayout'

import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Composer from './pages/Composer'
import Calendar from './pages/Calendar'
import Accounts from './pages/Accounts'
import Media from './pages/Media'
import Automations from './pages/Automations'
import Analytics from './pages/Analytics'
import Team from './pages/Team'
import Billing from './pages/Billing'
import Settings from './pages/Settings'
import Developer from './pages/Developer'
import Profile from './pages/Profile'
import Planner from './pages/Planner'
import Workspaces from './pages/Workspaces'
import InvitationAccept from './pages/InvitationAccept'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/invitations/:token" element={<ProtectedRoute><InvitationAccept /></ProtectedRoute>} />

            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="workspaces" element={<Workspaces />} />
              <Route path="composer" element={<Composer />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="planner" element={<Planner />} />
              <Route path="accounts" element={<Accounts />} />
              <Route path="media" element={<Media />} />
              <Route path="automations" element={<Automations />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="team" element={<Team />} />
              <Route path="billing" element={<Billing />} />
              <Route path="settings" element={<Settings />} />
              <Route path="developer" element={<Developer />} />
              <Route path="profile" element={<Profile />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
