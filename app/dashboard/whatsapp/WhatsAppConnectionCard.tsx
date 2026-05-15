'use client'

import type { WhatsAppConnectionRow } from '@/lib/actions/whatsapp'

interface Props {
  connection:    WhatsAppConnectionRow | null
  isConfigured:  boolean
  webhookUrl:    string
  verifyToken:   string
}

export default function WhatsAppConnectionCard({
  connection,
  isConfigured,
  webhookUrl,
  verifyToken,
}: Props) {
  const status = connection?.is_enabled
    ? isConfigured ? 'active' : 'unconfigured'
    : 'disabled'

  const statusColor =
    status === 'active'       ? 'text-[#22d093]' :
    status === 'unconfigured' ? 'text-[#ffae3c]' :
    'text-[#6a6a6e]'

  const statusLabel =
    status === 'active'       ? 'Active' :
    status === 'unconfigured' ? 'Enabled — Meta keys missing' :
    'Disabled'

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] p-6 flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#25d366]/10 border border-[#25d366]/20
                        flex items-center justify-center text-[#25d366] text-[18px]">
          ✆
        </div>
        <div>
          <p className="text-[13.5px] font-semibold text-white">WhatsApp Business</p>
          <p className={`text-[12px] font-medium mt-0.5 ${statusColor}`}>{statusLabel}</p>
        </div>
      </div>

      {connection?.display_phone_number && (
        <div className="flex flex-col gap-1">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#6a6a6e]">Phone Number</span>
          <span className="text-[13px] text-white font-mono">{connection.display_phone_number}</span>
        </div>
      )}

      {/* Webhook setup info */}
      <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-4">
        <p className="text-[11.5px] font-semibold text-[#6a6a6e] uppercase tracking-[0.1em]">
          Meta App Webhook Configuration
        </p>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] text-[#9a9a9d]">Webhook URL</span>
          <code className="text-[11.5px] text-[#ffae3c] bg-white/[0.04] rounded-lg px-3 py-2 font-mono break-all">
            {webhookUrl}
          </code>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] text-[#9a9a9d]">Verify Token</span>
          <code className="text-[11.5px] text-white bg-white/[0.04] rounded-lg px-3 py-2 font-mono">
            {verifyToken || <span className="text-[#ff8a7a]">WHATSAPP_VERIFY_TOKEN not set</span>}
          </code>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] text-[#9a9a9d]">Webhook Fields to Subscribe</span>
          <code className="text-[11.5px] text-[#22d093] bg-white/[0.04] rounded-lg px-3 py-2 font-mono">
            messages
          </code>
        </div>
      </div>

      {/* Env var status */}
      <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-4">
        <p className="text-[11.5px] font-semibold text-[#6a6a6e] uppercase tracking-[0.1em]">
          Server Environment
        </p>
        <EnvStatus label="META_ACCESS_TOKEN"         present={isConfigured} />
        <EnvStatus label="WHATSAPP_PHONE_NUMBER_ID"  present={isConfigured} />
        <EnvStatus label="WHATSAPP_VERIFY_TOKEN"     present={!!verifyToken} />
        <EnvStatus label="META_APP_SECRET"           present={false} hint="optional — enables signature verification" />
      </div>
    </div>
  )
}

function EnvStatus({ label, present, hint }: { label: string; present: boolean; hint?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-0.5 text-[11px] ${present ? 'text-[#22d093]' : 'text-[#ff8a7a]'}`}>
        {present ? '●' : '○'}
      </span>
      <div className="flex flex-col">
        <span className="text-[11px] font-mono text-[#9a9a9d]">{label}</span>
        {hint && <span className="text-[10px] text-[#6a6a6e]">{hint}</span>}
      </div>
    </div>
  )
}
