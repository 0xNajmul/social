import { useEffect, useMemo, useState } from 'react'
import { Clock3, Crown, Mail, RefreshCw, Search, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react'
import api from '../lib/api'
import { Badge, Button, Card, Input, PageLoader } from '../components/ui'

const ROLE_DETAILS = {
  owner: { label: 'Owner', color: 'amber', description: 'Full control, billing, and ownership.' },
  admin: { label: 'Admin', color: 'rose', description: 'Manages team, settings, and billing.' },
  manager: { label: 'Manager', color: 'violet', description: 'Reviews content and manages publishing.' },
  editor: { label: 'Editor', color: 'indigo', description: 'Creates, edits, and publishes content.' },
  viewer: { label: 'Viewer', color: 'slate', description: 'Views workspace content without editing.' },
}

export default function Team() {
  const [data, setData] = useState(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('editor')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState(null)
  const [confirmRemove, setConfirmRemove] = useState(null)

  const load = () => api.get('/team').then(({ data: response }) => setData(response))
  useEffect(() => { load().catch(() => setData({ members: [], invitations: [], permissions: {} })) }, [])

  const members = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (data?.members || []).filter((member) => !query || `${member.name} ${member.email} ${member.role}`.toLowerCase().includes(query))
  }, [data, search])

  const notify = (type, text) => setMessage({ type, text })

  const invite = async (event) => {
    event.preventDefault()
    setBusy('invite')
    setMessage(null)
    try {
      await api.post('/team/invite', { email, role })
      setEmail('')
      notify('success', 'Invitation sent successfully.')
      await load()
    } catch (error) {
      notify('error', error.response?.data?.message || 'Could not send the invitation.')
    } finally {
      setBusy('')
    }
  }

  const updateRole = async (member, nextRole) => {
    setBusy(`role-${member.id}`)
    try {
      await api.put(`/team/${member.id}/role`, { role: nextRole })
      notify('success', `${member.name}'s role was updated.`)
      await load()
    } catch (error) {
      notify('error', error.response?.data?.message || 'Could not update this role.')
    } finally {
      setBusy('')
    }
  }

  const removeMember = async (member) => {
    setBusy(`remove-${member.id}`)
    try {
      await api.delete(`/team/${member.id}`)
      notify('success', `${member.name} was removed from the workspace.`)
      setConfirmRemove(null)
      await load()
    } catch (error) {
      notify('error', error.response?.data?.message || 'Could not remove this member.')
    } finally {
      setBusy('')
    }
  }

  const invitationAction = async (invitation, action) => {
    setBusy(`${action}-${invitation.id}`)
    try {
      if (action === 'resend') await api.post(`/team/invitations/${invitation.id}/resend`)
      else await api.delete(`/team/invitations/${invitation.id}`)
      notify('success', action === 'resend' ? 'Invitation resent.' : 'Invitation cancelled.')
      await load()
    } catch (error) {
      notify('error', error.response?.data?.message || `Could not ${action} the invitation.`)
    } finally {
      setBusy('')
    }
  }

  if (!data) return <PageLoader />

  const canManage = Boolean(data.permissions?.can_manage)
  const isOwner = Boolean(data.permissions?.is_owner)
  const assignableRoles = isOwner ? ['admin', 'manager', 'editor', 'viewer'] : ['manager', 'editor', 'viewer']
  const adminCount = data.members.filter((member) => ['owner', 'admin'].includes(member.role)).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Team</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Invite collaborators and give each person the access they need.</p>
        </div>
        <Badge color={ROLE_DETAILS[data.current_role]?.color || 'slate'}>Your role: {ROLE_DETAILS[data.current_role]?.label || data.current_role}</Badge>
      </div>

      {message && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400' : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400'}`}>
          {message.text}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Summary icon={Users} label="Members" value={data.members.length} tone="brand" />
        <Summary icon={ShieldCheck} label="Admins" value={adminCount} tone="violet" />
        <Summary icon={Clock3} label="Pending invites" value={data.invitations.length} tone="amber" />
      </div>

      {canManage ? (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300"><UserPlus className="h-5 w-5" /></span>
              <div><h2 className="font-semibold text-slate-900 dark:text-white">Invite a teammate</h2><p className="text-sm text-slate-500 dark:text-slate-400">They will receive an email invitation valid for seven days.</p></div>
            </div>
          </div>
          <form onSubmit={invite} className="grid gap-4 p-5 md:grid-cols-[1fr_180px_auto] md:items-end">
            <Input label="Email address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@company.com" required />
            <RoleSelect label="Role" value={role} roles={assignableRoles} onChange={setRole} />
            <Button type="submit" loading={busy === 'invite'}><Mail className="h-4 w-4" /> Send invite</Button>
          </form>
        </Card>
      ) : (
        <Card className="flex items-start gap-3 border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-900">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-slate-400" />
          <div><p className="font-medium text-slate-800 dark:text-slate-100">Team management is read-only for your role</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Workspace owners and administrators can invite people or change access.</p></div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-semibold text-slate-900 dark:text-white">Workspace members</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{data.members.length} people have access.</p></div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search members..." className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </div>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {members.map((member) => {
            const owner = member.role === 'owner'
            const protectedAdmin = member.role === 'admin' && !isOwner
            const editable = canManage && !owner && !protectedAdmin && member.id !== data.current_user_id
            return (
              <div key={member.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {member.avatar_url ? <img src={member.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover" /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">{member.name?.[0]}</span>}
                    <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-semibold text-slate-900 dark:text-white">{member.name}</p>{member.id === data.current_user_id && <span className="text-xs text-slate-400">You</span>}</div><p className="truncate text-sm text-slate-500 dark:text-slate-400">{member.email}</p></div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    {editable ? (
                      <RoleSelect value={member.role} roles={assignableRoles} onChange={(nextRole) => updateRole(member, nextRole)} disabled={busy === `role-${member.id}`} compact />
                    ) : (
                      <Badge color={ROLE_DETAILS[member.role]?.color || 'slate'}>{owner && <Crown className="mr-1 h-3 w-3" />}{ROLE_DETAILS[member.role]?.label || member.role}</Badge>
                    )}
                    {editable && (
                      confirmRemove === member.id ? (
                        <div className="flex items-center gap-1 rounded-xl bg-rose-50 p-1 dark:bg-rose-950/30">
                          <Button size="sm" variant="danger" loading={busy === `remove-${member.id}`} onClick={() => removeMember(member)}>Remove</Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setConfirmRemove(member.id)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30" aria-label={`Remove ${member.name}`}><Trash2 className="h-4 w-4" /></button>
                      )
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {data.invitations.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800"><h2 className="font-semibold text-slate-900 dark:text-white">Pending invitations</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage invitations that have not been accepted yet.</p></div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.invitations.map((invitation) => (
              <div key={invitation.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300"><Mail className="h-4 w-4" /></span><div><p className="font-medium text-slate-800 dark:text-slate-100">{invitation.email}</p><p className="text-xs text-slate-400">Invited by {invitation.invited_by || 'a team admin'} · {invitation.is_expired ? 'Expired' : `Expires ${new Date(invitation.expires_at).toLocaleDateString()}`}</p></div></div>
                <div className="flex items-center gap-2"><Badge color={invitation.is_expired ? 'rose' : ROLE_DETAILS[invitation.role]?.color}>{invitation.role}</Badge>{canManage && <><Button size="sm" variant="secondary" loading={busy === `resend-${invitation.id}`} onClick={() => invitationAction(invitation, 'resend')}><RefreshCw className="h-3.5 w-3.5" /> Resend</Button><Button size="sm" variant="ghost" className="text-rose-600 dark:text-rose-400" loading={busy === `cancel-${invitation.id}`} onClick={() => invitationAction(invitation, 'cancel')}><Trash2 className="h-3.5 w-3.5" /></Button></>}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Object.entries(ROLE_DETAILS).map(([key, detail]) => <div key={key} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"><Badge color={detail.color}>{detail.label}</Badge><p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{detail.description}</p></div>)}
      </div>
    </div>
  )
}

function Summary({ icon: Icon, label, value, tone }) {
  const colors = { brand: 'bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300', violet: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300', amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300' }
  return <Card className="flex items-center gap-4 p-4"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${colors[tone]}`}><Icon className="h-5 w-5" /></span><div><p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p><p className="text-sm text-slate-500 dark:text-slate-400">{label}</p></div></Card>
}

function RoleSelect({ label, value, roles, onChange, disabled, compact = false }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>}
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={`rounded-xl border border-slate-300 bg-white text-sm capitalize text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 ${compact ? 'px-3 py-1.5' : 'w-full px-3.5 py-2.5'}`}>
        {roles.map((item) => <option key={item} value={item}>{ROLE_DETAILS[item]?.label || item}</option>)}
      </select>
    </label>
  )
}
