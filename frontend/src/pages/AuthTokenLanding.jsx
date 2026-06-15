import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { tokenStore, workspaceStore } from '../lib/api'
import { PageLoader } from '../components/ui'

export default function AuthTokenLanding() {
  const [params] = useSearchParams()

  useEffect(() => {
    const token = params.get('token') || params.get('google_token')

    if (token) {
      tokenStore.set(token)
      workspaceStore.clear()
      window.location.replace('/app')
      return
    }

    window.location.replace(`/login${params.get('google_error') ? `?google_error=${encodeURIComponent(params.get('google_error'))}` : ''}`)
  }, [params])

  return <PageLoader />
}
