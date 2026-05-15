import { getWhatsAppConnection, getWhatsAppMessages } from '@/lib/actions/whatsapp'
import { isWhatsAppConfigured } from '@/lib/whatsapp/client'
import WhatsAppConnectionCard from './WhatsAppConnectionCard'
import WhatsAppSettingsForm   from './WhatsAppSettingsForm'
import WhatsAppMessageLog     from './WhatsAppMessageLog'

export const metadata = { title: 'WhatsApp — Helios AI' }

export default async function WhatsAppPage() {
  const [{ connection, plan, error: connErr }, { messages, error: msgErr }] = await Promise.all([
    getWhatsAppConnection(),
    getWhatsAppMessages(30),
  ])

  const isConfigured = isWhatsAppConfigured()
  const appUrl       = process.env.NEXT_PUBLIC_APP_URL ?? 'https://helios.ai'
  const webhookUrl   = `${appUrl}/api/webhooks/whatsapp`
  const verifyToken  = process.env.WHATSAPP_VERIFY_TOKEN ? '(set)' : ''

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      {/* Page header */}
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[22px] font-semibold tracking-tight text-white">WhatsApp</h1>
        <p className="text-[13px] text-[#6a6a6e]">
          Connect your WhatsApp Business number to handle customer inquiries with AI.
        </p>
      </div>

      {/* Errors */}
      {connErr && (
        <div className="rounded-xl bg-[#ff8a7a]/10 border border-[#ff8a7a]/20 px-4 py-3 text-[12.5px] text-[#ff8a7a]">
          {connErr}
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        {/* Left: settings form */}
        <WhatsAppSettingsForm
          connection={connection}
          plan={plan}
          isConfigured={isConfigured}
        />

        {/* Right: connection status + webhook info */}
        <div className="flex flex-col gap-4">
          <WhatsAppConnectionCard
            connection={connection}
            isConfigured={isConfigured}
            webhookUrl={webhookUrl}
            verifyToken={verifyToken}
          />

          {/* Quick setup guide */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] p-5 flex flex-col gap-3">
            <p className="text-[12px] font-semibold text-[#6a6a6e] uppercase tracking-[0.1em]">
              Quick Setup
            </p>
            <ol className="flex flex-col gap-2.5 list-none">
              {[
                'Create a Meta Developer App at developers.facebook.com',
                'Add the WhatsApp product to your app',
                'Copy your Phone Number ID and Business Account ID',
                'Generate a permanent System User access token',
                'Set META_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and WHATSAPP_VERIFY_TOKEN in your env',
                'Configure the webhook URL and verify token in the Meta App dashboard',
                'Subscribe to the "messages" webhook field',
                'Enable the channel below (requires Pro plan)',
              ].map((step, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-white/[0.06] text-[10px] text-[#6a6a6e]
                                   flex items-center justify-center shrink-0 mt-0.5 font-mono">
                    {i + 1}
                  </span>
                  <span className="text-[11.5px] text-[#9a9a9d] leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {/* Message log */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-white">Message Log</h2>
          {msgErr && (
            <span className="text-[11.5px] text-[#ff8a7a]">{msgErr}</span>
          )}
        </div>
        <WhatsAppMessageLog messages={messages} />
      </div>
    </div>
  )
}
