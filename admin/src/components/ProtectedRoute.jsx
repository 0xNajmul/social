import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PageLoader } from './ui'

export default function ProtectedRoute({ children }) {
  const { admin, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!admin) return <Navigate to="/login" replace />
  return children
}
