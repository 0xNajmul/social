import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './components/DashboardLayout'

import Landing from './pages/Landing'
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Composer = lazy(() => import('./pages/Composer'))
const Accounts = lazy(() => import('./pages/Accounts'))
const Media = lazy(() => import('./pages/Media'))
const MediaEdit = lazy(() => import('./pages/MediaEdit'))
const Automations = lazy(() => import('./pages/Automations'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Team = lazy(() => import('./pages/Team'))
const Billing = lazy(() => import('./pages/Billing'))
const Settings = lazy(() => import('./pages/Settings'))
const Developer = lazy(() => import('./pages/Developer'))
const Profile = lazy(() => import('./pages/Profile'))
const Planner = lazy(() => import('./pages/Planner'))
const Organizer = lazy(() => import('./pages/Organizer'))
const Workspaces = lazy(() => import('./pages/Workspaces'))
const WorkspaceEdit = lazy(() => import('./pages/WorkspaceEdit'))
const InviteEarn = lazy(() => import('./pages/InviteEarn'))
const AuthTokenLanding = lazy(() => import('./pages/AuthTokenLanding'))
const InvitationAccept = lazy(() => import('./pages/InvitationAccept'))

function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600 dark:border-slate-800 dark:border-t-brand-400" />
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/impersonate" element={<AuthTokenLanding />} />
            <Route path="/auth/google/callback" element={<AuthTokenLanding />} />
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
              <Route path="workspaces/:id" element={<WorkspaceEdit />} />
              <Route path="composer" element={<Composer />} />
              <Route path="calendar" element={<Navigate to="/app/organizer" replace />} />
              <Route path="organizer" element={<Organizer />} />
              <Route path="planner" element={<Planner />} />
              <Route path="accounts" element={<Accounts />} />
              <Route path="media" element={<Media />} />
              <Route path="media/:id/edit" element={<MediaEdit />} />
              <Route path="automations" element={<Automations />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="team" element={<Team />} />
              <Route path="billing" element={<Billing />} />
              <Route path="pricing-plan" element={<Billing />} />
              <Route path="settings" element={<Settings />} />
              <Route path="developer" element={<Developer />} />
              <Route path="profile" element={<Profile />} />
              <Route path="invite" element={<InviteEarn />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
