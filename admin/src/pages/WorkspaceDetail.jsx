import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, CalendarClock, Share2, Users } from 'lucide-react'
import api from '../lib/api'
import { Badge, Button, Card, PageLoader, StatCard } from '../components/ui'

export default function WorkspaceDetail() {
  const { slug } = useParams()
  const [workspace, setWorkspace] = useState(null)

  useEffect(() => {
    api.get(`/admin/workspaces/${slug}`).then(({ data }) => setWorkspace(data.data)).catch(() => setWorkspace(false))
  }, [slug])

  if (workspace === null) return <PageLoader />
  if (workspace === false) {
    return (
      <Card className="p-8 text-center">
        <p className="font-semibold text-white">Workspace not found</p>
        <Link to="/workspaces" className="mt-4 inline-block"><Button variant="secondary">Back to workspaces</Button></Link>
      </Card>
    )
  }

  const pendingInvitations = (workspace.invitations || []).filter((invitation) => invitation.is_pending)

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <Link to="/workspaces" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-300 hover:text-brand-200"><ArrowLeft className="h-4 w-4" /> Back to workspaces</Link>
          <div className="mt-4 flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white" style={{ backgroundColor: workspace.brand_color || '#4f46e5' }}>{workspace.name?.[0] || 'W'}</span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-white">{workspace.name}</h1>
                {workspace.on_trial ? <Badge color="amber">Trial</Badge> : <Badge color="emerald">Active</Badge>}
              </div>
              <p className="mt-1 text-sm text-slate-400">{workspace.description || 'No workspace description added.'}</p>
              <p className="mt-2 text-xs text-slate-500">{workspace.slug} · {workspace.timezone}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Members" value={workspace.members_count ?? 0} hint={`${workspace.pending_invitations_count ?? pendingInvitations.length} pending invitations`} />
        <StatCard icon={Share2} label="Connected Accounts" value={workspace.social_accounts_count ?? 0} hint="Social automation accounts" />
        <StatCard icon={CalendarClock} label="Posts" value={workspace.posts_count ?? 0} hint="Workspace posts" />
        <StatCard icon={Building2} label="Package" value={workspace.subscription?.plan?.name || 'No plan'} hint="Owner account package" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <SectionTitle title="Members" subtitle="Users with access to this workspace." />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-800/40 text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="p-4">User</th><th className="p-4">Email</th><th className="p-4">Role</th><th className="p-4">Joined</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {(workspace.members || []).map((member) => (
                    <tr key={member.id}>
                      <td className="p-4 font-medium text-white">{member.name}</td>
                      <td className="p-4 text-slate-400">{member.email}</td>
                      <td className="p-4"><Badge color={member.role === 'owner' ? 'amber' : 'indigo'}>{member.role || '-'}</Badge></td>
                      <td className="p-4 text-slate-500">{member.created_at ? new Date(member.created_at).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                  {(workspace.members || []).length === 0 && <tr><td colSpan="4" className="p-10 text-center text-slate-500">No members found.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <SectionTitle title="Pending Member Requests" subtitle="Open invitations for this team." />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-800/40 text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="p-4">Email</th><th className="p-4">Role</th><th className="p-4">Invited by</th><th className="p-4">Expires</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {pendingInvitations.map((invitation) => (
                    <tr key={invitation.id}>
                      <td className="p-4 text-white">{invitation.email}</td>
                      <td className="p-4"><Badge color="amber">{invitation.role}</Badge></td>
                      <td className="p-4 text-slate-400">{invitation.invited_by || '-'}</td>
                      <td className="p-4 text-slate-500">{invitation.expires_at ? new Date(invitation.expires_at).toLocaleString() : '-'}</td>
                    </tr>
                  ))}
                  {pendingInvitations.length === 0 && <tr><td colSpan="4" className="p-10 text-center text-slate-500">No pending invitations.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <SectionTitle title="Connected Accounts" subtitle="Social accounts connected to this workspace." />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-800/40 text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="p-4">Account</th><th className="p-4">Platform</th><th className="p-4">Status</th><th className="p-4">Last synced</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {(workspace.social_accounts || []).map((account) => (
                    <tr key={account.id}>
                      <td className="p-4 text-white">{account.name || account.username || '-'}</td>
                      <td className="p-4 text-slate-400">{account.platform_label || account.platform}</td>
                      <td className="p-4"><Badge color={account.status === 'active' ? 'emerald' : 'rose'}>{account.status || '-'}</Badge></td>
                      <td className="p-4 text-slate-500">{account.last_synced_at ? new Date(account.last_synced_at).toLocaleString() : '-'}</td>
                    </tr>
                  ))}
                  {(workspace.social_accounts || []).length === 0 && <tr><td colSpan="4" className="p-10 text-center text-slate-500">No connected accounts.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="space-y-4 p-5">
            <h2 className="font-semibold text-white">Owner</h2>
            <Detail label="Name" value={workspace.owner?.name || '-'} />
            <Detail label="Email" value={workspace.owner?.email || '-'} />
          </Card>

          <Card className="space-y-4 p-5">
            <h2 className="font-semibold text-white">Subscription</h2>
            <Detail label="Plan" value={workspace.subscription?.plan?.name || '-'} />
            <Detail label="Status" value={workspace.subscription?.status || (workspace.on_trial ? 'trialing' : '-')} />
            <Detail label="Trial ends" value={workspace.trial_ends_at ? new Date(workspace.trial_ends_at).toLocaleString() : '-'} />
          </Card>

          <Card className="space-y-4 p-5">
            <h2 className="font-semibold text-white">Workspace</h2>
            <Detail label="ID" value={workspace.id} />
            <Detail label="Slug" value={workspace.slug} />
            <Detail label="Timezone" value={workspace.timezone || '-'} />
            <Detail label="Created" value={workspace.created_at ? new Date(workspace.created_at).toLocaleString() : '-'} />
          </Card>
        </aside>
      </div>
    </div>
  )
}

function SectionTitle({ title, subtitle }) {
  return (
    <div className="border-b border-slate-800 px-5 py-4">
      <h2 className="font-semibold text-white">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </div>
  )
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm text-slate-200">{value}</p>
    </div>
  )
}
