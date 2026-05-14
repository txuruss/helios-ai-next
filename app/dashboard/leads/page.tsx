import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/dashboard/PageHeader'
import type { Lead } from '@/types'

const STATUS_PILL: Record<string, string> = {
  new:       'pill pill-orange',
  qualified: 'pill pill-green',
  contacted: 'pill pill-cyan',
  proposal:  'pill pill-amber',
  won:       'pill pill-green',
  lost:      'pill pill-mute',
}

const SOURCE_LABEL: Record<string, string> = {
  widget: 'Widget', whatsapp: 'WhatsApp', form: 'Form', manual: 'Manual', api: 'API',
}

export default async function LeadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('business_members').select('business_id').eq('user_id', user?.id ?? '').limit(1).single()

  const { data: leads } = membership
    ? await supabase
        .from('leads')
        .select('*')
        .eq('business_id', membership.business_id)
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: [] as Lead[] }

  return (
    <>
      <PageHeader
        eyebrow="Lead Pipeline"
        title="Leads"
        description="All inbound leads captured by your AI assistant, forms, and WhatsApp."
        action={
          <button className="btn-ghost btn-sm">Export CSV</button>
        }
      />

      {!leads || leads.length === 0 ? (
        <div className="border border-white/10 rounded-2xl p-12 text-center">
          <div className="text-4xl mb-3">◎</div>
          <h3 className="text-[18px] font-semibold mb-2">No leads yet</h3>
          <p className="text-[14px] text-[#9a9a9d] mb-5">
            Leads will appear here once your AI assistant or widget captures inquiries.
            Deploy the widget (Phase 2) to start collecting leads.
          </p>
        </div>
      ) : (
        <div className="border border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="helios-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email / Phone</th>
                  <th>Intent</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead: Lead) => (
                  <tr key={lead.id}>
                    <td className="font-medium text-white whitespace-nowrap">{lead.name ?? '—'}</td>
                    <td className="text-[#9a9a9d] text-[13px]">{lead.email ?? lead.phone ?? '—'}</td>
                    <td className="text-[#9a9a9d] max-w-[160px] truncate text-[13px]">{lead.intent ?? '—'}</td>
                    <td>
                      <span className="text-[11px] px-2 py-1 rounded-md bg-white/[0.05] border border-white/[0.06] text-[#9a9a9d]">
                        {SOURCE_LABEL[lead.source] ?? lead.source}
                      </span>
                    </td>
                    <td>
                      <span className={STATUS_PILL[lead.status] ?? 'pill pill-mute'}>{lead.status}</span>
                    </td>
                    <td>
                      {lead.score != null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${lead.score}%`,
                                background: lead.score >= 85 ? '#22d093' : lead.score >= 70 ? '#ffb547' : '#6a6a6e',
                              }}
                            />
                          </div>
                          <span className="font-mono text-[12px] text-[#9a9a9d]">{lead.score}</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="text-[#6a6a6e] font-mono text-[12px] whitespace-nowrap">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <button className="h-7 px-3 rounded-lg text-[12px] border border-white/10 bg-white/[0.02]
                                          text-[#9a9a9d] hover:text-white hover:border-white/[0.18] transition-all whitespace-nowrap">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
