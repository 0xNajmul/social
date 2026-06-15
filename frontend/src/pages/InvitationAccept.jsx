import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Loader2, Users, XCircle } from 'lucide-react'
import api, { workspaceStore } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Button, Card } from '../components/ui'

export default function InvitationAccept() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { reload } = useAuth()
  const [state, setState] = useState({ status: 'loading', message: 'Joining workspace...' })

  useEffect(() => {
    api.post(`/invitations/${token}/accept`)
      .then(async ({ data }) => {
        workspaceStore.set(data.workspace_slug)
        await reload()
        setState({ status: 'success', message: data.message })
      })
      .catch((error) => setState({ status: 'error', message: error.response?.data?.message || 'This invitation could not be accepted.' }))
  }, [reload, token])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
          {state.status === 'loading' && <Loader2 className="h-7 w-7 animate-spin" />}
          {state.status === 'success' && <CheckCircle2 className="h-7 w-7" />}
          {state.status === 'error' && <XCircle className="h-7 w-7 text-rose-500" />}
        </div>
        <h1 className="mt-5 text-xl font-bold text-slate-900 dark:text-white">Workspace invitation</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{state.message}</p>
        {state.status !== 'loading' && (
          <Button className="mt-6" onClick={() => navigate(state.status === 'success' ? '/app/team' : '/app')}>
            <Users className="h-4 w-4" /> {state.status === 'success' ? 'Open team' : 'Back to dashboard'}
          </Button>
        )}
      </Card>
    </div>
  )
}
