import { useEffect, useMemo, useState } from 'react'
import { Mail } from 'lucide-react'
import api from '../../lib/api'
import { Button, Input, Modal } from '../ui'
import RoleSelect from './RoleSelect'
import { DEFAULT_INVITE_ROLES } from './teamRoles'

export default function TeamInviteModal({ open, roles, onClose, onInvited }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('editor')
  const [discoveredRoles, setDiscoveredRoles] = useState(DEFAULT_INVITE_ROLES)
  const [canManage, setCanManage] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const roleOptions = useMemo(() => roles || discoveredRoles, [discoveredRoles, roles])
  const selectedRole = roleOptions.includes(role) ? role : roleOptions.includes('editor') ? 'editor' : roleOptions[0]
  const canSubmit = roles ? true : canManage

  useEffect(() => {
    if (!open || roles) return
    api.get('/team')
      .then(({ data }) => {
        const isOwner = Boolean(data.permissions?.is_owner)
        setCanManage(Boolean(data.permissions?.can_manage))
        setDiscoveredRoles(isOwner ? ['admin', ...DEFAULT_INVITE_ROLES] : DEFAULT_INVITE_ROLES)
      })
      .catch(() => {
        setCanManage(true)
        setDiscoveredRoles(DEFAULT_INVITE_ROLES)
      })
  }, [open, roles])

  const close = () => {
    setMessage('')
    onClose?.()
  }

  const invite = async (event) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const { data } = await api.post('/team/invite', { email, role: selectedRole })
      setEmail('')
      setRole(roleOptions.includes('editor') ? 'editor' : roleOptions[0])
      onInvited?.(data.data)
      close()
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not send the invitation.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} title="Invite team member" description="They will receive an email invitation valid for seven days." onClose={close} size="lg">
      <form onSubmit={invite} className="space-y-4 p-5">
        {message && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400">{message}</div>}
        {!canSubmit && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            Your current workspace role cannot invite team members.
          </div>
        )}
        <Input label="Email address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@company.com" required />
        <RoleSelect label="Role" value={selectedRole} roles={roleOptions} onChange={setRole} disabled={!canSubmit} />
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={!canSubmit || !email}>
            <Mail className="h-4 w-4" /> Send invite
          </Button>
        </div>
      </form>
    </Modal>
  )
}
