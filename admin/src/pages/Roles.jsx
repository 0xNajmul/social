import { useEffect, useMemo, useState } from 'react'
import { Edit3, KeyRound, Plus, Search, ShieldCheck, Trash2, X } from 'lucide-react'
import clsx from 'clsx'
import api from '../lib/api'
import { Badge, Button, Card, Input, Modal, PageLoader, Textarea } from '../components/ui'

const PERMISSIONS = [
  { key: 'dashboard.view', label: 'View dashboard', group: 'Overview' },
  { key: 'users.manage', label: 'Manage users', group: 'People' },
  { key: 'roles.manage', label: 'Manage roles', group: 'People' },
  { key: 'posts.manage', label: 'Manage posts', group: 'Content' },
  { key: 'plans.manage', label: 'Manage plans', group: 'Billing' },
  { key: 'workspaces.manage', label: 'Manage workspaces', group: 'Workspaces' },
  { key: 'jobs.manage', label: 'Manage jobs', group: 'Operations' },
  { key: 'settings.manage', label: 'Manage settings', group: 'System' },
]

const EMPTY = {
  name: '',
  description: '',
  permissions: Object.fromEntries(PERMISSIONS.map((permission) => [permission.key, false])),
}

export default function Roles() {
  const [roles, setRoles] = useState(null)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [message, setMessage] = useState(null)

  const load = () => api.get('/admin/roles').then(({ data }) => setRoles(data.data || []))

  useEffect(() => {
    load().catch(() => setRoles([]))
  }, [])

  const filteredRoles = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return roles || []

    return (roles || []).filter((role) => `${role.name} ${role.description || ''} ${role.slug}`.toLowerCase().includes(term))
  }, [query, roles])

  const groupedPermissions = useMemo(() => PERMISSIONS.reduce((groups, permission) => {
    groups[permission.group] = [...(groups[permission.group] || []), permission]
    return groups
  }, {}), [])

  const openCreate = () => {
    setEditing('new')
    setForm(EMPTY)
    setErrors({})
  }

  const openEdit = (role) => {
    setEditing(role)
    setForm({
      name: role.name,
      description: role.description || '',
      permissions: { ...EMPTY.permissions, ...(role.permissions || {}) },
    })
    setErrors({})
  }

  const close = () => {
    setEditing(null)
    setErrors({})
  }

  const togglePermission = (key) => {
    setForm((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [key]: !current.permissions[key],
      },
    }))
  }

  const save = async (event) => {
    event.preventDefault()
    setBusy(true)
    setErrors({})

    try {
      const payload = {
        name: form.name,
        description: form.description,
        permissions: form.permissions,
      }

      if (editing === 'new') await api.post('/admin/roles', payload)
      else await api.put(`/admin/roles/${editing.id}`, payload)

      setMessage({ type: 'success', text: editing === 'new' ? 'Role created.' : 'Role updated.' })
      close()
      await load()
    } catch (error) {
      setErrors(error.response?.data?.errors || {})
      if (!error.response?.data?.errors) setMessage({ type: 'error', text: error.response?.data?.message || 'Could not save this role.' })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!confirmDelete) return
    setBusy(true)
    try {
      await api.delete(`/admin/roles/${confirmDelete.id}`)
      setMessage({ type: 'success', text: 'Role deleted.' })
      setConfirmDelete(null)
      await load()
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Could not delete this role.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Roles</h1>
          <p className="mt-1 text-sm text-slate-400">Create custom admin roles and choose which platform areas they can manage.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
          <div className="relative flex-1 xl:w-80">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search roles..." className="pl-9 pr-9" />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-500 hover:bg-slate-700 hover:text-white" aria-label="Clear role search">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> Add role</Button>
        </div>
      </div>

      {message && <Notice message={message} />}

      {!roles ? <PageLoader /> : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-800/30 uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Role</th>
                    <th className="px-3 py-2 font-semibold">Permissions</th>
                    <th className="px-3 py-2 font-semibold">Admins</th>
                    <th className="px-3 py-2 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredRoles.map((role) => {
                    const enabled = PERMISSIONS.filter((permission) => role.permissions?.[permission.key])
                    return (
                      <tr key={role.id} className="text-slate-300 transition hover:bg-slate-800/35">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600/20 text-brand-300"><ShieldCheck className="h-4 w-4" /></span>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-white">{role.name}</p>
                                {role.is_system && <Badge color="indigo">System</Badge>}
                              </div>
                              <p className="mt-0.5 max-w-md truncate text-[11px] text-slate-500">{role.description || role.slug}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex max-w-xl flex-wrap gap-1.5">
                            {enabled.slice(0, 5).map((permission) => <Badge key={permission.key} color="slate">{permission.label}</Badge>)}
                            {enabled.length > 5 && <Badge color="violet">+{enabled.length - 5}</Badge>}
                            {enabled.length === 0 && <span className="text-slate-500">No permissions</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-400">{role.users_count || 0}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1.5">
                            <ActionIcon tone="edit" label={`Edit ${role.name}`} title="Edit role" onClick={() => openEdit(role)}><Edit3 className="h-3.5 w-3.5" /></ActionIcon>
                            <ActionIcon tone="delete" label={`Delete ${role.name}`} title="Delete role" disabled={role.is_system || Number(role.users_count || 0) > 0} onClick={() => setConfirmDelete(role)}><Trash2 className="h-3.5 w-3.5" /></ActionIcon>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredRoles.length === 0 && <tr><td colSpan="4" className="px-3 py-10 text-center text-slate-500">No roles found.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600/20 text-brand-300"><KeyRound className="h-5 w-5" /></span>
              <div>
                <h2 className="font-bold text-white">Permission groups</h2>
                <p className="mt-1 text-sm text-slate-400">Use roles for admin-panel access patterns. Workspace roles still control user workspaces.</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {Object.entries(groupedPermissions).map(([group, permissions]) => (
                <div key={group} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <p className="text-sm font-semibold text-slate-200">{group}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{permissions.map((permission) => permission.label).join(', ')}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <Modal open={Boolean(editing)} title={editing === 'new' ? 'Create role' : 'Edit role'} description="Choose the admin permissions this role should grant." onClose={close} size="xl">
        <form onSubmit={save} className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Role name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} error={errors.name?.[0]} required disabled={editing?.is_system} />
            <Textarea label="Description" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} error={errors.description?.[0]} className="sm:col-span-1" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(groupedPermissions).map(([group, permissions]) => (
              <div key={group} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="font-semibold text-white">{group}</p>
                <div className="mt-3 space-y-2">
                  {permissions.map((permission) => (
                    <label key={permission.key} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={Boolean(form.permissions?.[permission.key])}
                        onChange={() => togglePermission(permission.key)}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-brand-600"
                      />
                      {permission.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
            <Button type="button" size="sm" variant="ghost" onClick={close}>Cancel</Button>
            <Button type="submit" size="sm" loading={busy}><ShieldCheck className="h-4 w-4" /> Save role</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(confirmDelete)} title="Delete role" description="Only unused custom roles can be deleted." onClose={() => setConfirmDelete(null)} size="md">
        <div className="p-5">
          <p className="text-sm text-slate-300">Delete <strong className="text-white">{confirmDelete?.name}</strong>?</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button size="sm" variant="danger" loading={busy} onClick={remove}>Delete role</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Notice({ message }) {
  return <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-900/60 bg-emerald-950/30 text-emerald-300' : 'border-rose-900/60 bg-rose-950/30 text-rose-300'}`}>{message.text}</div>
}

function ActionIcon({ tone, label, title, children, ...props }) {
  const tones = {
    edit: 'border-amber-800/60 bg-amber-950/50 text-amber-300 hover:bg-amber-900/70',
    delete: 'border-rose-800/60 bg-rose-950/50 text-rose-300 hover:bg-rose-900/70 disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-600',
  }

  return (
    <button
      type="button"
      className={clsx('inline-flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-60', tones[tone])}
      aria-label={label}
      title={title}
      {...props}
    >
      {children}
    </button>
  )
}
