import Link from 'next/link'
import { ArrowLeft, Users, Activity } from 'lucide-react'
import { requireFounderAdmin } from '@/lib/auth/require-admin'
import { getTeamMembers, type TeamMemberRow } from '@/lib/data/admin-team'
import {
  getTeamActivity, parseActivityRange, ACTIVITY_RANGES, type AgentActivityRow,
} from '@/lib/data/admin-team-activity'

export const metadata = { title: 'Team Access — Mission Control' }

export default async function AdminTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  // Founder-only. /admin/team is NOT in the outreach allowlist, so scoped
  // roles are blocked by the layout too — this is the explicit second gate.
  const session = await requireFounderAdmin({ path: '/admin/team' })

  const { range: rawRange } = await searchParams
  const range = parseActivityRange(rawRange)
  const rangeLabel = ACTIVITY_RANGES.find((r) => r.value === range)?.label ?? 'All Time'

  // Both reads re-check founder access internally (defense in depth).
  const [{ rows, migrationNeeded, error }, activity] = await Promise.all([
    getTeamMembers(),
    getTeamActivity(range),
  ])

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <Link
          href="/admin/mission-control"
          className="text-[12px] text-[#6a6a6e] hover:text-[#ffae3c] flex items-center gap-1.5 mb-1 w-fit transition-colors"
        >
          <ArrowLeft size={12} /> Back to Mission Control
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-[24px] font-bold tracking-tight text-white flex items-center gap-2">
            <Users size={20} className="text-[#ff7a18]" /> Team Access
          </h1>
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.10em]
                           px-2.5 py-1 rounded-full border border-[#ff7a18]/30 bg-[#ff7a18]/[0.07] text-[#ffae3c]">
            Founder only · read-only
          </span>
        </div>
        <p className="text-[13.5px] text-[#9a9a9d]">
          Internal staff and the roles that scope their dashboard access. Viewing as {session.fullName ?? session.email}.
        </p>
      </header>

      {migrationNeeded && (
        <div className="rounded-xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05] px-4 py-2.5 text-[12.5px] text-[#ffae3c]">
          The <code className="font-mono text-[11.5px]">allowed_tools</code> column is missing — apply migration{' '}
          <code className="font-mono text-[11.5px]">20260607120000_add_outreach_agent_roles.sql</code> in Supabase to
          enable outreach-agent logins. The roster below still renders.
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-[#ff6a5a]/30 bg-[#ff6a5a]/[0.05] px-4 py-2.5 text-[12.5px] text-[#ff8a7a]">
          {error}
        </div>
      )}

      {/* ── Team Activity (founder-only outreach performance rollup) ── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-[15px] font-semibold text-white flex items-center gap-2">
            <Activity size={14} className="text-[#ff7a18]" /> Team Activity
          </h2>
          {/* Range filter — server-rendered links, ACL re-runs on every request */}
          <nav className="flex items-center gap-1.5 flex-wrap" aria-label="Activity range">
            {ACTIVITY_RANGES.map((r) => {
              const active = r.value === range
              return (
                <Link key={r.value}
                  href={r.value === 'all' ? '/admin/team' : `/admin/team?range=${r.value}`}
                  className={`inline-flex items-center text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${
                    active
                      ? 'border-[#ff7a18] bg-[#ff7a18]/[0.14] text-[#ffae3c]'
                      : 'border-white/[0.1] bg-white/[0.03] text-[#9a9a9d] hover:bg-white/[0.07] hover:text-white'
                  }`}>
                  {r.label}
                </Link>
              )
            })}
          </nav>
        </div>

        {activity.error && (
          <div className="rounded-xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05] px-4 py-2.5 text-[12.5px] text-[#ffae3c]">
            {activity.error}
          </div>
        )}

        <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[820px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <Th>Agent</Th>
                  <Th>Saved Today</Th>
                  {range !== 'all' && <Th>Saved ({rangeLabel})</Th>}
                  <Th>Total Saved</Th>
                  <Th>Contacted ({rangeLabel})</Th>
                  <Th>Follow-Ups Due</Th>
                  <Th>Last Activity</Th>
                </tr>
              </thead>
              <tbody>
                {activity.rows.length === 0 ? (
                  <tr>
                    <td colSpan={range !== 'all' ? 7 : 6} className="px-4 py-8 text-center text-[13px] text-[#6a6a6e]">
                      No outreach agents found.
                    </td>
                  </tr>
                ) : (
                  activity.rows.map((a) => <ActivityRow key={a.teamMemberId} agent={a} showRange={range !== 'all'} />)
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-[11.5px] text-[#6a6a6e]">
          Saved = research leads saved by the agent · Contacted = outreach leads marked contacted (latest touch) ·
          Follow-ups = due today or overdue on active leads. Agents never see each other&apos;s numbers — this rollup is founder-only.
        </p>
      </section>

      {/* ── Roster ── */}
      <h2 className="text-[15px] font-semibold text-white -mb-2">Team Access</h2>
      <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Allowed tools</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[13px] text-[#6a6a6e]">
                    No team members found.
                  </td>
                </tr>
              ) : (
                rows.map((m) => <TeamRow key={m.id} member={m} />)
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[12px] text-[#6a6a6e]">
        Roles and access are managed directly in the <code className="font-mono text-[11px]">team_members</code> table
        (Supabase). This page is read-only by design.
      </p>
    </div>
  )
}

function ActivityRow({ agent, showRange }: { agent: AgentActivityRow; showRange: boolean }) {
  const last = agent.lastActivity
    ? new Date(agent.lastActivity).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'No activity yet'
  return (
    <tr className="border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02]">
      <Td className="whitespace-nowrap">
        <div className="text-white font-medium flex items-center gap-2">
          {agent.name ?? '—'}
          {agent.status !== 'active' && <StatusBadge status={agent.status} />}
        </div>
        <div className="font-mono text-[11px] text-[#6a6a6e] mt-0.5">{agent.email}</div>
      </Td>
      <Td><Num value={agent.savedToday} tone={agent.savedToday > 0 ? '#3ecf8e' : undefined} /></Td>
      {showRange && <Td><Num value={agent.savedInRange} /></Td>}
      <Td><Num value={agent.totalSaved} /></Td>
      <Td><Num value={agent.contactedInRange} /></Td>
      <Td><Num value={agent.followUpsDue} tone={agent.followUpsDue > 0 ? '#ffae3c' : undefined} /></Td>
      <Td className={`whitespace-nowrap text-[12px] ${agent.lastActivity ? 'text-[#9a9a9d]' : 'text-[#6a6a6e]'}`}>{last}</Td>
    </tr>
  )
}

function Num({ value, tone }: { value: number; tone?: string }) {
  return (
    <span className="text-[13.5px] font-semibold tabular-nums" style={{ color: tone ?? (value > 0 ? '#e7e7ea' : '#6a6a6e') }}>
      {value}
    </span>
  )
}

function TeamRow({ member }: { member: TeamMemberRow }) {
  const created = member.created_at
    ? new Date(member.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—'
  return (
    <tr className="border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02]">
      <Td className="text-white font-medium">{member.full_name ?? '—'}</Td>
      <Td className="font-mono text-[12px] text-[#9a9a9d]">{member.email}</Td>
      <Td><RoleBadge role={member.role} /></Td>
      <Td><StatusBadge status={member.status} /></Td>
      <Td>
        {member.allowed_tools.length === 0 ? (
          <span className="text-[#6a6a6e]">—</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {member.allowed_tools.map((t) => (
              <span key={t} className="inline-flex items-center rounded-md border border-white/[0.08] bg-white/[0.03]
                                       px-1.5 py-0.5 text-[10.5px] font-mono text-[#b9b9bd]">
                {t}
              </span>
            ))}
          </span>
        )}
      </Td>
      <Td className="text-[#9a9a9d] whitespace-nowrap">{created}</Td>
    </tr>
  )
}

function RoleBadge({ role }: { role: string }) {
  const isFounder = role === 'founder_admin'
  const isOutreach = role === 'outreach_agent'
  const cls = isFounder
    ? 'border-[#ff7a18]/30 bg-[#ff7a18]/[0.08] text-[#ffae3c]'
    : isOutreach
      ? 'border-[#4aa3ff]/30 bg-[#4aa3ff]/[0.08] text-[#8fc4ff]'
      : 'border-white/[0.10] bg-white/[0.03] text-[#b9b9bd]'
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {role}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'active'    ? 'border-[#3ecf8e]/30 bg-[#3ecf8e]/[0.08] text-[#6ee7b7]' :
    status === 'invited'   ? 'border-[#ffae3c]/30 bg-[#ffae3c]/[0.08] text-[#ffd089]' :
    status === 'suspended' ? 'border-[#ff6a5a]/30 bg-[#ff6a5a]/[0.08] text-[#ff8a7a]' :
                             'border-white/[0.10] bg-white/[0.03] text-[#b9b9bd]'
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {status}
    </span>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.10em] text-[#6a6a6e]">
      {children}
    </th>
  )
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-[13px] align-middle ${className}`}>{children}</td>
}
