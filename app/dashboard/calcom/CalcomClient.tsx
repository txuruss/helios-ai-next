'use client'

import { useState, useTransition } from 'react'
import { syncCalcomEventTypes } from '@/lib/actions/calcom'

interface DbEventType {
  id:           string
  calcom_id:    number | null
  title:        string
  slug:         string | null
  duration_min: number | null
  is_active:    boolean
}

interface Props {
  eventTypes:       DbEventType[]
  apiKeyConfigured: boolean
  lastSynced:       string | null
}

export default function CalcomClient({ eventTypes: initialEventTypes, apiKeyConfigured, lastSynced }: Props) {
  const [eventTypes, setEventTypes]   = useState<DbEventType[]>(initialEventTypes)
  const [syncResult, setSyncResult]   = useState<{ ok: boolean; message: string } | null>(null)
  const [pending, startTransition]    = useTransition()

  const handleSync = () => {
    setSyncResult(null)
    startTransition(async () => {
      const result = await syncCalcomEventTypes()
      if (result.success) {
        setSyncResult({ ok: true, message: result.success })
        // Reload the page to refresh all data
        window.location.reload()
      } else {
        setSyncResult({ ok: false, message: result.error ?? 'Sync failed.' })
      }
    })
  }

  return (
    <>
      {/* Config status */}
      <div className="border border-white/10 rounded-2xl p-6 mb-5">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
            apiKeyConfigured ? 'bg-[#22d093]/12 border border-[#22d093]/25' : 'bg-[#ff6a5a]/10 border border-[#ff6a5a]/20'
          }`}>
            {apiKeyConfigured ? '✓' : '⚠'}
          </div>
          <div className="flex-1">
            <div className={`text-[14px] font-semibold ${apiKeyConfigured ? 'text-white' : 'text-[#ff8a7a]'}`}>
              {apiKeyConfigured ? 'CALCOM_API_KEY configured' : 'CALCOM_API_KEY missing'}
            </div>
            <p className="text-[13px] text-[#9a9a9d] mt-0.5">
              {apiKeyConfigured
                ? `Last synced: ${lastSynced ? new Date(lastSynced).toLocaleString() : 'Never'}`
                : 'Add CALCOM_API_KEY to .env.local and restart the dev server.'}
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={!apiKeyConfigured || pending}
            className="btn-primary btn-sm disabled:opacity-50 shrink-0">
            {pending
              ? <><span className="w-4 h-4 rounded-full border-2 border-[#1a0c00]/30 border-t-[#1a0c00] animate-spin" />Syncing…</>
              : 'Sync Event Types'}
          </button>
        </div>

        {syncResult && (
          <div className={`mt-4 px-4 py-3 rounded-xl text-[13px] ${
            syncResult.ok
              ? 'bg-[#22d093]/10 border border-[#22d093]/30 text-[#22d093]'
              : 'bg-[#ff6a5a]/10 border border-[#ff6a5a]/30 text-[#ff8a7a]'
          }`}>
            {syncResult.message}
          </div>
        )}
      </div>

      {/* Event Types table */}
      <div className="border border-white/10 rounded-2xl overflow-hidden mb-5">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-[15px] font-semibold">Synced Event Types</h3>
          <p className="text-[13px] text-[#9a9a9d] mt-0.5">
            {eventTypes.length > 0
              ? `${eventTypes.length} event type${eventTypes.length !== 1 ? 's' : ''} from Cal.com`
              : 'No event types synced yet.'}
          </p>
        </div>

        {eventTypes.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[13.5px] text-[#6a6a6e]">
              {apiKeyConfigured
                ? 'Click "Sync Event Types" to import your Cal.com event types.'
                : 'Configure CALCOM_API_KEY first.'}
            </p>
          </div>
        ) : (
          <table className="helios-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {eventTypes.map((et) => (
                <tr key={et.id}>
                  <td className="font-medium text-white">{et.title}</td>
                  <td className="font-mono text-[12px] text-[#9a9a9d]">/{et.slug ?? '—'}</td>
                  <td className="text-[#9a9a9d]">{et.duration_min ? `${et.duration_min} min` : '—'}</td>
                  <td>
                    <span className={`pill ${et.is_active ? 'pill-green' : 'pill-mute'}`}>
                      {et.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
