import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './components/AdminLayout'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Users = lazy(() => import('./pages/Users'))
const UserDetail = lazy(() => import('./pages/UserDetail'))
const Roles = lazy(() => import('./pages/Roles'))
const Posts = lazy(() => import('./pages/Posts'))
const PostDetail = lazy(() => import('./pages/PostDetail'))
const Feed = lazy(() => import('./pages/Feed'))
const News = lazy(() => import('./pages/News'))
const AdminDataPage = lazy(() => import('./pages/AdminDataPage'))
const Plans = lazy(() => import('./pages/Plans'))
const Workspaces = lazy(() => import('./pages/Workspaces'))
const WorkspaceDetail = lazy(() => import('./pages/WorkspaceDetail'))
const Jobs = lazy(() => import('./pages/Jobs'))
const Profile = lazy(() => import('./pages/Profile'))
const Settings = lazy(() => import('./pages/Settings'))

function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-800 border-t-brand-500" />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}
            >
              <Route index element={<Dashboard />} />
              <Route path="users" element={<Users />} />
              <Route path="users/:id" element={<UserDetail />} />
              <Route path="roles" element={<Roles />} />
              <Route path="posts" element={<Posts />} />
              <Route path="posts/:id" element={<PostDetail />} />
              <Route path="feed" element={<Feed />} />
              <Route path="news" element={<News />} />
              <Route path="planners" element={<AdminDataPage type="planners" />} />
              <Route path="media" element={<AdminDataPage type="media" />} />
              <Route path="automations" element={<AdminDataPage type="automations" />} />
              <Route path="accounts" element={<AdminDataPage type="accounts" />} />
              <Route path="plans" element={<Plans />} />
              <Route path="workspaces" element={<Workspaces />} />
              <Route path="workspaces/:slug" element={<WorkspaceDetail />} />
              <Route path="reports/notifications" element={<AdminDataPage type="report-notifications" />} />
              <Route path="reports/affiliate-incomes" element={<AdminDataPage type="report-affiliate-incomes" />} />
              <Route path="reports/login-history" element={<AdminDataPage type="report-login-history" />} />
              <Route path="reports/ai-usage" element={<AdminDataPage type="report-ai-usage" />} />
              <Route path="reports/ai-usage-history" element={<AdminDataPage type="report-ai-usage" />} />
              <Route path="reports/email-history" element={<AdminDataPage type="report-email-history" />} />
              <Route path="reports/user-transaction-history" element={<AdminDataPage type="report-user-transaction-history" />} />
              <Route path="reports/activity-logs" element={<AdminDataPage type="report-activity-logs" />} />
              <Route path="jobs" element={<Jobs />} />
              <Route path="profile" element={<Profile />} />
              <Route path="settings" element={<Settings />} />
              <Route path="settings/:settingId" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
