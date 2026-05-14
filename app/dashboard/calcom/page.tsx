'use client'

import PageHeader from '@/components/dashboard/PageHeader'

export default function CalcomPage() {
  return (
    <>
      <PageHeader
        eyebrow="Cal.com Integration"
        title="Cal.com"
        description="Connect your Cal.com account so your AI assistant can check real availability and confirm bookings."
      />

      {/* Connection status */}
      <div className="border border-white/10 rounded-2xl p-8 mb-5">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06]
                          flex items-center justify-center text-2xl shrink-0">
            🗓
          </div>
          <div className="flex-1">
            <h3 className="text-[18px] font-semibold mb-1">Cal.com not connected</h3>
            <p className="text-[14px] text-[#9a9a9d]">
              Connect your Cal.com account to enable live availability checking and automatic booking confirmation.
            </p>
          </div>
          <button
            className="btn-primary shrink-0"
            onClick={() => {
              // Phase 2: Redirect to Cal.com OAuth flow
              // window.location.href = '/api/calcom/oauth'
              alert('Phase 2: Cal.com OAuth will be connected here.')
            }}
          >
            Connect Cal.com
          </button>
        </div>
      </div>

      {/* Event Types placeholder */}
      <div className="border border-white/10 rounded-2xl p-6 mb-5">
        <h3 className="text-[16px] font-semibold mb-1">Event Types</h3>
        <p className="text-[14px] text-[#9a9a9d] mb-6">
          After connecting, your Cal.com event types will appear here.
        </p>
        <div className="border border-dashed border-white/[0.08] rounded-xl p-8 text-center">
          <p className="text-[14px] text-[#6a6a6e]">No event types found — connect Cal.com first.</p>
        </div>
      </div>

      {/* Service mapping placeholder */}
      <div className="border border-white/10 rounded-2xl p-6">
        <h3 className="text-[16px] font-semibold mb-1">Service → Event Type Mapping</h3>
        <p className="text-[14px] text-[#9a9a9d] mb-6">
          Map each Helios service to a Cal.com event type. Your AI will use these mappings to create bookings.
        </p>
        <div className="border border-dashed border-white/[0.08] rounded-xl p-8 text-center">
          <p className="text-[14px] text-[#6a6a6e]">Add services in <strong className="text-white">/dashboard/services</strong> first, then map them here.</p>
        </div>
      </div>

      {/* Phase 2 guide */}
      <div className="mt-6 p-5 rounded-2xl border border-[#ffae3c]/20 bg-[#ffae3c]/[0.04]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ffae3c] mb-2">Phase 2 Implementation</div>
        <ul className="text-[13.5px] text-[#9a9a9d] flex flex-col gap-1.5 list-disc list-inside">
          <li>Add <code className="font-mono text-[#5be3c5]">CALCOM_API_KEY</code> to <code className="font-mono text-[#5be3c5]">.env.local</code></li>
          <li>Create <code className="font-mono text-[#5be3c5]">app/api/calcom/oauth/route.ts</code> for OAuth flow</li>
          <li>Fetch event types via <code className="font-mono text-[#5be3c5]">GET /api/calcom/event-types</code></li>
          <li>Store Cal.com tokens in <code className="font-mono text-[#5be3c5]">calcom_connections</code> table (server-side only)</li>
        </ul>
      </div>
    </>
  )
}
