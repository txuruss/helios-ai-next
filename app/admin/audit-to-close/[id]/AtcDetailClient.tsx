'use client'

// Audit-to-Close lead workspace: summary cards, action buttons, and the
// Overview / Audit / Pain Points / Qualification / Offer / Outreach /
// Activity Log tabs. All mutations call the real server actions; access
// is enforced server-side (this UI only hides founder-only controls).

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Check, Play, Sparkles, Target, FileText, Send, Archive, UserPlus } from 'lucide-react'
import AdminKpiCard from '@/components/admin/ui/AdminKpiCard'
import ConfirmActionDialog from '@/components/admin/ui/ConfirmActionDialog'
import AtcLeadModal from '../AtcLeadModal'
import {
  ATC_STATUS_CONFIG, ATC_AUDIT_CATEGORIES, FIT_LEVEL_CONFIG, DIFFICULTY_CONFIG,
  SEVERITY_CONFIG, painCategoryLabel,
  type AtcAuditCategoryKey,
} from '@/lib/atc/types'
import type { AtcLeadDetail } from '@/lib/data/atc-leads'
import {
  saveAtcAudit, generatePainPoints, qualifyLead, buildSalesOffer,
  generateOutreachMessages, runAuditToClose, setAtcLeadStatus,
  archiveAtcLead, convertAtcLeadToClient, assignAtcLead,
} from '@/lib/actions/atc'
import { PLAN_FEES, isAdminPlan } from '@/lib/admin/plan-pricing'

const TABS = ['Overview', 'Audit', 'Pain Points', 'Qualification', 'Offer', 'Outreach', 'Activity Log'] as const
type Tab = (typeof TABS)[number]

const inputCls =
  'w-full px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[13px] text-white ' +
  'placeholder-[#6a6a6e] focus:outline-none focus:border-[#ff7a18]/40 focus:bg-white/[0.04] transition-all'
const labelCls = 'text-[11px] font-medium text-[#9a9a9d] mb-1 block'
const cardCls  = 'rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 p-4'
const btnCls   =
  'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12.5px] font-medium border transition-all disabled:opacity-50 '
const btnOrange  = btnCls + 'bg-[#ff7a18]/[0.14] border-[#ff7a18]/40 text-[#ffae3c] hover:bg-[#ff7a18]/25 hover:text-white'
const btnNeutral = btnCls + 'border-white/[0.08] bg-white/[0.03] text-[#9a9a9d] hover:bg-white/[0.06] hover:text-white'

function fmtWhen(iso: string): string {
  try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) } catch { return '—' }
}

type CatDraft = { score: string; issue: string; why_it_matters: string; suggested_fix: string; helios_opportunity: string }

export default function AtcDetailClient({
  detail, isFounder, members,
}: {
  detail:    AtcLeadDetail
  isFounder: boolean
  members:   Array<{ id: string; label: string }>
}) {
  const router = useRouter()
  const { lead, audit, painPoints, runs } = detail
  const [tab, setTab] = useState<Tab>('Overview')
  const [busy, start] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [confirmConvert, setConfirmConvert] = useState(false)

  // ── Audit form state (seeded from the saved audit) ────────────────
  const [auditSummary, setAuditSummary] = useState(audit?.audit_summary ?? '')
  const [cats, setCats] = useState<Record<AtcAuditCategoryKey, CatDraft>>(() => {
    const init = {} as Record<AtcAuditCategoryKey, CatDraft>
    for (const c of ATC_AUDIT_CATEGORIES) {
      const saved = audit?.audit_json[c.key]
      init[c.key] = {
        score:              saved?.score != null ? String(saved.score) : '',
        issue:              saved?.issue ?? '',
        why_it_matters:     saved?.why_it_matters ?? '',
        suggested_fix:      saved?.suggested_fix ?? '',
        helios_opportunity: saved?.helios_opportunity ?? '',
      }
    }
    return init
  })
  const [openCat, setOpenCat] = useState<AtcAuditCategoryKey | null>(ATC_AUDIT_CATEGORIES[0].key)

  const setCat = (key: AtcAuditCategoryKey, field: keyof CatDraft, value: string) =>
    setCats((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }))

  // ── Action runner (shared feedback handling) ──────────────────────
  function run(label: string, fn: () => Promise<{ ok: boolean; error?: string; errors?: string[]; warnings?: string[] }>) {
    setMsg(null)
    start(async () => {
      const r = await fn()
      if (r.ok) {
        const warn = r.warnings?.length ? ` ${r.warnings.join(' ')}` : ''
        setMsg({ kind: 'ok', text: `${label} done.${warn}` })
        router.refresh()
      } else {
        setMsg({ kind: 'err', text: r.error ?? r.errors?.join(' ') ?? `${label} failed.` })
      }
    })
  }

  function saveAudit() {
    const categories: Record<string, { score: string | null; issue: string; why_it_matters: string; suggested_fix: string; helios_opportunity: string }> = {}
    for (const c of ATC_AUDIT_CATEGORIES) {
      const d = cats[c.key]
      categories[c.key] = { ...d, score: d.score.trim() === '' ? null : d.score }
    }
    run('Save audit', () => saveAtcAudit(lead.id, { audit_summary: auditSummary, categories }))
  }

  // ── Summary card values ───────────────────────────────────────────
  const st  = ATC_STATUS_CONFIG[lead.status]
  const fit = lead.fit_level ? FIT_LEVEL_CONFIG[lead.fit_level] : null
  const dif = lead.close_difficulty ? DIFFICULTY_CONFIG[lead.close_difficulty] : null
  const pkgLabel = lead.recommended_package && isAdminPlan(lead.recommended_package)
    ? PLAN_FEES[lead.recommended_package].label : null
  const lastActivity = useMemo(() => {
    const latest = runs[0]?.created_at ?? lead.updated_at
    return fmtWhen(latest)
  }, [runs, lead.updated_at])

  return (
    <div className="flex flex-col gap-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <AdminKpiCard label="Fit score" value={lead.fit_score ?? '—'} sublabel={fit?.label} tone={lead.fit_score !== null && lead.fit_score >= 60 ? 'success' : 'neutral'} />
        <AdminKpiCard label="Package" value={pkgLabel ?? '—'} tone={pkgLabel ? 'orange' : 'neutral'} />
        <AdminKpiCard label="Audit score" value={audit?.overall_score ?? '—'} sublabel="/100" tone={audit ? 'info' : 'neutral'} />
        <AdminKpiCard label="Close difficulty" value={dif?.label ?? '—'} tone={lead.close_difficulty === 'easy' ? 'success' : lead.close_difficulty === 'hard' ? 'danger' : 'neutral'} />
        <AdminKpiCard label="Status" value={st.label} />
        <AdminKpiCard label="Assigned" value={lead.assigned_to_name ?? '—'} sublabel={`Last activity ${lastActivity}`} />
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnOrange} disabled={busy} onClick={() => run('Full Audit-to-Close', () => runAuditToClose(lead.id))}>
          <Play size={13} /> Run Full Audit-to-Close
        </button>
        <button type="button" className={btnNeutral} disabled={busy} onClick={() => run('Pain points', () => generatePainPoints(lead.id))}>
          <Sparkles size={13} /> Generate Pain Points
        </button>
        <button type="button" className={btnNeutral} disabled={busy} onClick={() => run('Qualification', () => qualifyLead(lead.id))}>
          <Target size={13} /> Qualify Lead
        </button>
        <button type="button" className={btnNeutral} disabled={busy} onClick={() => run('Offer', () => buildSalesOffer(lead.id))}>
          <FileText size={13} /> Generate Offer
        </button>
        <button type="button" className={btnNeutral} disabled={busy} onClick={() => run('Outreach drafts', () => generateOutreachMessages(lead.id))}>
          <Send size={13} /> Generate Outreach
        </button>
        <button type="button" className={btnNeutral} disabled={busy} onClick={() => run('Status', () => setAtcLeadStatus(lead.id, 'ready_for_outreach'))}>
          Mark Ready for Outreach
        </button>
        <button type="button" className={btnNeutral} disabled={busy} onClick={() => run('Status', () => setAtcLeadStatus(lead.id, 'contacted'))}>
          Mark Contacted
        </button>
        {isFounder && (
          <button type="button" className={btnNeutral} disabled={busy} onClick={() => setConfirmConvert(true)}>
            <UserPlus size={13} /> Convert to Client
          </button>
        )}
        <button type="button" className={btnNeutral} disabled={busy} onClick={() => setConfirmArchive(true)}>
          <Archive size={13} /> Archive
        </button>
      </div>

      {msg && (
        <div className={`rounded-xl border px-4 py-2.5 text-[12.5px] ${
          msg.kind === 'ok'
            ? 'border-[#22d093]/30 bg-[#22d093]/[0.05] text-[#22d093]'
            : 'border-[#ff8a7a]/30 bg-[#ff8a7a]/[0.05] text-[#ff8a7a]'
        }`}>
          {msg.text}
        </div>
      )}
      {busy && <div className="text-[12px] text-[#ffae3c]">Working — AI generation can take up to a minute…</div>}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-white/[0.06]">
        {TABS.map((t) => (
          <button
            key={t} type="button" onClick={() => setTab(t)}
            className={`px-3.5 py-2 text-[12.5px] font-medium rounded-t-lg transition-colors ${
              tab === t ? 'text-[#ffae3c] border-b-2 border-[#ff7a18] bg-white/[0.02]' : 'text-[#9a9a9d] hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'Overview' && (
        <div className="flex flex-col gap-4">
          <div className={cardCls}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13.5px] font-semibold text-white">Lead details</h3>
              <button type="button" className={btnNeutral} onClick={() => setEditOpen(true)}>Edit lead</button>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2.5">
              {([
                ['Industry', lead.industry], ['Location', lead.location],
                ['Website', lead.website_url], ['Google Maps', lead.google_maps_url],
                ['Phone', lead.phone], ['Email', lead.email],
                ['Instagram', lead.instagram_url], ['Facebook', lead.facebook_url],
                ['WhatsApp', lead.whatsapp_number], ['Opening hours', lead.opening_hours],
                ['Rating', lead.rating !== null ? `${lead.rating}★` : null],
                ['Reviews', lead.review_count !== null ? String(lead.review_count) : null],
                ['Source', lead.source], ['Added by', lead.created_by_name ?? 'Unknown'],
              ] as Array<[string, string | null]>).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10.5px] font-semibold uppercase tracking-[0.10em] text-[#6a6a6e]">{k}</dt>
                  <dd className="text-[13px] text-[#cfd3dc] break-words">{v ?? '—'}</dd>
                </div>
              ))}
            </dl>
            {lead.services && (
              <div className="mt-3">
                <dt className="text-[10.5px] font-semibold uppercase tracking-[0.10em] text-[#6a6a6e]">Services</dt>
                <dd className="text-[13px] text-[#cfd3dc] whitespace-pre-wrap">{lead.services}</dd>
              </div>
            )}
            {lead.notes && (
              <div className="mt-3">
                <dt className="text-[10.5px] font-semibold uppercase tracking-[0.10em] text-[#6a6a6e]">Notes</dt>
                <dd className="text-[13px] text-[#cfd3dc] whitespace-pre-wrap">{lead.notes}</dd>
              </div>
            )}
          </div>

          {isFounder && (
            <div className={cardCls}>
              <h3 className="text-[13.5px] font-semibold text-white mb-2">Assignment (founder only)</h3>
              <div className="flex items-center gap-2.5 flex-wrap">
                <select
                  className={`${inputCls} max-w-[280px] cursor-pointer`}
                  value={lead.assigned_to_team_member_id ?? ''}
                  disabled={busy}
                  onChange={(e) => {
                    const v = e.target.value
                    run('Assignment', () => assignAtcLead(lead.id, v === '' ? null : v))
                  }}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <span className="text-[11.5px] text-[#6a6a6e]">Assigned agents can see and work this lead.</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Audit ── */}
      {tab === 'Audit' && (
        <div className="flex flex-col gap-3">
          <div className={cardCls}>
            <label className={labelCls}>Audit summary</label>
            <textarea className={`${inputCls} resize-none`} rows={3} value={auditSummary}
              onChange={(e) => setAuditSummary(e.target.value)}
              placeholder="Overall picture: what did you find when you checked their website, socials, and booking path?" />
          </div>

          {ATC_AUDIT_CATEGORIES.map((c) => {
            const d = cats[c.key]
            const open = openCat === c.key
            const hasContent = d.score !== '' || d.issue || d.suggested_fix
            return (
              <div key={c.key} className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 overflow-hidden">
                <button type="button" onClick={() => setOpenCat(open ? null : c.key)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left">
                  <span className="text-[13px] font-medium text-white">{c.label}</span>
                  <span className="flex items-center gap-2.5">
                    {d.score !== '' && <span className="text-[13px] font-bold tabular-nums text-[#ffae3c]">{d.score}/10</span>}
                    {hasContent && d.score === '' && <span className="text-[11px] text-[#6a6a6e]">notes</span>}
                    <span className="text-[11px] text-[#6a6a6e]">{open ? 'Hide' : 'Edit'}</span>
                  </span>
                </button>
                {open && (
                  <div className="px-4 pb-4 pt-1 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Score (0–10)</label>
                      <input className={inputCls} inputMode="numeric" value={d.score}
                        onChange={(e) => setCat(c.key, 'score', e.target.value)} placeholder="0–10" />
                    </div>
                    <div>
                      <label className={labelCls}>Issue found</label>
                      <input className={inputCls} value={d.issue}
                        onChange={(e) => setCat(c.key, 'issue', e.target.value)} placeholder="What did you observe?" />
                    </div>
                    <div>
                      <label className={labelCls}>Why it matters</label>
                      <input className={inputCls} value={d.why_it_matters}
                        onChange={(e) => setCat(c.key, 'why_it_matters', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Suggested fix</label>
                      <input className={inputCls} value={d.suggested_fix}
                        onChange={(e) => setCat(c.key, 'suggested_fix', e.target.value)} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Helios AI opportunity</label>
                      <input className={inputCls} value={d.helios_opportunity}
                        onChange={(e) => setCat(c.key, 'helios_opportunity', e.target.value)}
                        placeholder="How an AI assistant would close this gap" />
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <div className="flex justify-end">
            <button type="button" className={btnOrange} disabled={busy} onClick={saveAudit}>
              {busy ? 'Saving…' : 'Save Audit'}
            </button>
          </div>
        </div>
      )}

      {/* ── Pain Points ── */}
      {tab === 'Pain Points' && (
        <div className="flex flex-col gap-3">
          {painPoints.length === 0 && (
            <div className={cardCls}>
              <p className="text-[13px] text-[#9a9a9d]">
                No pain points yet. Save an audit, then use <span className="text-[#ffae3c]">Generate Pain Points</span> above.
              </p>
            </div>
          )}
          {painPoints.map((p) => {
            const sev = SEVERITY_CONFIG[p.severity]
            return (
              <div key={p.id} className={cardCls}>
                <div className="flex items-center gap-2.5 flex-wrap mb-2">
                  <span className="text-[13px] font-semibold text-white">{painCategoryLabel(p.category)}</span>
                  <span className="text-[10.5px] font-semibold px-2 py-[2px] rounded-full border"
                    style={{ color: sev.color, borderColor: `${sev.color}33`, background: `${sev.color}12` }}>
                    {sev.label}
                  </span>
                </div>
                <dl className="flex flex-col gap-1.5 text-[12.5px]">
                  {p.evidence             && <div><dt className="inline font-medium text-[#9a9a9d]">Evidence: </dt><dd className="inline text-[#cfd3dc]">{p.evidence}</dd></div>}
                  {p.business_impact      && <div><dt className="inline font-medium text-[#9a9a9d]">Impact: </dt><dd className="inline text-[#cfd3dc]">{p.business_impact}</dd></div>}
                  {p.recommended_solution && <div><dt className="inline font-medium text-[#9a9a9d]">Fix: </dt><dd className="inline text-[#cfd3dc]">{p.recommended_solution}</dd></div>}
                  {p.sales_angle          && <div><dt className="inline font-medium text-[#9a9a9d]">Angle: </dt><dd className="inline text-[#ffae3c]">{p.sales_angle}</dd></div>}
                </dl>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Qualification ── */}
      {tab === 'Qualification' && (
        <div className="flex flex-col gap-3">
          {!lead.qualification_json ? (
            <div className={cardCls}>
              <p className="text-[13px] text-[#9a9a9d]">
                Not qualified yet. Save an audit, then use <span className="text-[#ffae3c]">Qualify Lead</span> above —
                scoring is rule-based and transparent.
              </p>
            </div>
          ) : (
            <>
              <div className={cardCls}>
                <h3 className="text-[13.5px] font-semibold text-white mb-1.5">Summary</h3>
                <p className="text-[13px] text-[#cfd3dc]">{lead.qualification_json.qualification_summary}</p>
                <p className="text-[12.5px] text-[#ffae3c] mt-2">
                  <span className="font-medium text-[#9a9a9d]">Best outreach angle: </span>
                  {lead.qualification_json.best_outreach_angle}
                </p>
              </div>
              <div className={cardCls}>
                <h3 className="text-[13.5px] font-semibold text-white mb-2">Likely objections</h3>
                <ul className="flex flex-col gap-1.5">
                  {lead.qualification_json.objections.map((o, i) => (
                    <li key={i} className="text-[12.5px] text-[#cfd3dc]">• {o}</li>
                  ))}
                </ul>
              </div>
              <div className={cardCls}>
                <h3 className="text-[13.5px] font-semibold text-white mb-2">Score breakdown (rule-based)</h3>
                <div className="flex flex-col gap-1.5">
                  {lead.qualification_json.signals.map((sg, i) => (
                    <div key={i} className="flex items-start gap-3 text-[12.5px]">
                      <span className="w-10 shrink-0 text-right font-bold tabular-nums text-[#ffae3c]">+{sg.points}</span>
                      <span className="text-[#cfd3dc]"><span className="font-medium text-white">{sg.signal}.</span> {sg.note}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Offer ── */}
      {tab === 'Offer' && (
        <div className="flex flex-col gap-3">
          {!lead.offer_json ? (
            <div className={cardCls}>
              <p className="text-[13px] text-[#9a9a9d]">
                No offer yet. Qualify the lead, then use <span className="text-[#ffae3c]">Generate Offer</span> above.
                Prices always come from the canonical package definitions — never from the AI.
              </p>
            </div>
          ) : (
            <div className={cardCls}>
              <div className="flex items-baseline gap-3 flex-wrap mb-3">
                <h3 className="text-[16px] font-bold text-white">{lead.offer_json.package_name}</h3>
                <span className="text-[13.5px] font-semibold text-[#ffae3c]">
                  {lead.offer_json.setup_price_label} setup + {lead.offer_json.monthly_price_label}
                </span>
              </div>
              <Section title="Diagnosis">{lead.offer_json.diagnosis}</Section>
              <ListSection title="Main pain points" items={lead.offer_json.main_pain_points} />
              <ListSection title="What Helios AI will build" items={lead.offer_json.what_we_build} />
              <Section title="Why it matters">{lead.offer_json.why_it_matters}</Section>
              <Section title="Timeline">{lead.offer_json.timeline}</Section>
              <ListSection title="Setup deliverables" items={lead.offer_json.deliverables} />
              <ListSection title="Monthly retainer covers" items={lead.offer_json.monthly_covers} />
              <Section title="Next step">{lead.offer_json.cta}</Section>
              {lead.offer_generated_at && (
                <p className="text-[10.5px] text-[#6a6a6e] italic mt-2">Generated {fmtWhen(lead.offer_generated_at)} — review and edit before presenting.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Outreach ── */}
      {tab === 'Outreach' && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-[#ffae3c]/30 bg-[#ffae3c]/[0.05] px-4 py-2.5 text-[12.5px] text-[#ffae3c]">
            Drafts only. Nothing is ever sent automatically — review, edit, and send each message yourself.
          </div>
          {!lead.outreach_json ? (
            <div className={cardCls}>
              <p className="text-[13px] text-[#9a9a9d]">
                No outreach drafts yet. Qualify the lead, then use <span className="text-[#ffae3c]">Generate Outreach</span> above.
              </p>
            </div>
          ) : (
            <>
              <DraftBlock title="Cold email" text={`Subject: ${lead.outreach_json.cold_email.subject}\n\n${lead.outreach_json.cold_email.body}`} />
              <DraftBlock title="Follow-up email" text={`Subject: ${lead.outreach_json.follow_up_email.subject}\n\n${lead.outreach_json.follow_up_email.body}`} />
              <DraftBlock title="Instagram DM" text={lead.outreach_json.instagram_dm} />
              <DraftBlock title="WhatsApp message" text={lead.outreach_json.whatsapp_message} />
              <DraftBlock title="Call script" text={lead.outreach_json.call_script} />
            </>
          )}
        </div>
      )}

      {/* ── Activity Log ── */}
      {tab === 'Activity Log' && (
        <div className={cardCls}>
          {runs.length === 0 ? (
            <p className="text-[13px] text-[#9a9a9d]">No generation runs yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {runs.map((r) => (
                <div key={r.id} className="flex items-start gap-3 py-1.5 border-b border-white/[0.04] last:border-0">
                  <span className={`mt-[3px] w-2 h-2 rounded-full shrink-0 ${
                    r.status === 'completed' ? 'bg-[#22d093]' : r.status === 'failed' ? 'bg-[#ff8a7a]' : 'bg-[#ffae3c]'
                  }`} />
                  <div className="min-w-0">
                    <div className="text-[12.5px] text-white">
                      <span className="font-medium">{r.agent_name}</span>
                      <span className="text-[#6a6a6e]"> · {r.status} · {fmtWhen(r.created_at)}</span>
                      {r.created_by_name && <span className="text-[#6a6a6e]"> · by {r.created_by_name}</span>}
                    </div>
                    {r.error_message && <div className="text-[11.5px] text-[#ff8a7a] break-words">{r.error_message}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {editOpen && (
        <AtcLeadModal lead={lead} onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); router.refresh() }} />
      )}
      <ConfirmActionDialog
        open={confirmArchive}
        title="Archive this lead?"
        body={`${lead.business_name} will be hidden from the active list. Nothing is deleted.`}
        confirmLabel="Archive"
        loading={busy}
        onCancel={() => setConfirmArchive(false)}
        onConfirm={() => {
          setConfirmArchive(false)
          run('Archive', async () => {
            const r = await archiveAtcLead(lead.id)
            if (r.ok) router.push('/admin/audit-to-close')
            return r
          })
        }}
      />
      <ConfirmActionDialog
        open={confirmConvert}
        title="Convert to client pipeline?"
        body={`${lead.business_name} will be added to the agency sales pipeline (Leads → Clients) as a qualified lead, and this lead will be marked closed.`}
        confirmLabel="Convert"
        loading={busy}
        onCancel={() => setConfirmConvert(false)}
        onConfirm={() => {
          setConfirmConvert(false)
          run('Convert', () => convertAtcLeadToClient(lead.id))
        }}
      />
    </div>
  )
}

// ── Small presentational helpers ─────────────────────────────────────

function Section({ title, children }: { title: string; children: string }) {
  if (!children) return null
  return (
    <div className="mb-3">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.10em] text-[#6a6a6e] mb-1">{title}</div>
      <p className="text-[13px] text-[#cfd3dc] whitespace-pre-wrap">{children}</p>
    </div>
  )
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null
  return (
    <div className="mb-3">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.10em] text-[#6a6a6e] mb-1">{title}</div>
      <ul className="flex flex-col gap-1">
        {items.map((x, i) => <li key={i} className="text-[13px] text-[#cfd3dc]">• {x}</li>)}
      </ul>
    </div>
  )
}

function DraftBlock({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0f1012]/80 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[13px] font-semibold text-white">{title}</h3>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            } catch { /* clipboard unavailable */ }
          }}
          className="flex items-center gap-1.5 text-[11.5px] text-[#9a9a9d] hover:text-[#ffae3c] transition-colors"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="text-[12.5px] text-[#cfd3dc] whitespace-pre-wrap">{text}</p>
    </div>
  )
}
