'use client'

import { useState, useTransition } from 'react'
import { updateWhatsAppConnection, sendTestWhatsAppMessage } from '@/lib/actions/whatsapp'
import type { WhatsAppConnectionRow } from '@/lib/actions/whatsapp'

interface Props {
  connection:   WhatsAppConnectionRow | null
  plan:         string
  isConfigured: boolean
}

const PLAN_ORDER: Record<string, number> = { starter: 0, pro: 1, scale: 2 }

export default function WhatsAppSettingsForm({ connection, plan, isConfigured }: Props) {
  const canEnable = (PLAN_ORDER[plan] ?? 0) >= (PLAN_ORDER['pro'] ?? 1)

  const [isEnabled,    setIsEnabled]    = useState(connection?.is_enabled ?? false)
  const [displayPhone, setDisplayPhone] = useState(connection?.display_phone_number ?? '')
  const [bizAcctId,    setBizAcctId]    = useState(connection?.business_account_id  ?? '')
  const [testPhone,    setTestPhone]    = useState('')

  const [saveMsg,   setSaveMsg]   = useState<string | null>(null)
  const [saveErr,   setSaveErr]   = useState<string | null>(null)
  const [testMsg,   setTestMsg]   = useState<string | null>(null)
  const [testErr,   setTestErr]   = useState<string | null>(null)

  const [savePending, startSave] = useTransition()
  const [testPending, startTest] = useTransition()

  const handleSave = () => {
    setSaveMsg(null)
    setSaveErr(null)
    startSave(async () => {
      const fd = new FormData()
      fd.append('is_enabled',           String(isEnabled))
      fd.append('display_phone_number', displayPhone)
      fd.append('business_account_id',  bizAcctId)
      const result = await updateWhatsAppConnection(fd)
      if (result.error)   setSaveErr(result.error)
      if (result.success) setSaveMsg(result.success)
    })
  }

  const handleTestSend = () => {
    setTestMsg(null)
    setTestErr(null)
    startTest(async () => {
      const result = await sendTestWhatsAppMessage(testPhone.replace(/\D/g, ''))
      if (result.error)   setTestErr(result.error)
      if (result.success) setTestMsg(result.success)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Enable / Disable toggle */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] p-6 flex flex-col gap-5">
        <h3 className="text-[13.5px] font-semibold text-white">Channel Settings</h3>

        {!canEnable && (
          <div className="rounded-xl bg-[#ff7a18]/[0.08] border border-[#ff7a18]/20 px-4 py-3
                          text-[12.5px] text-[#ffae3c]">
            WhatsApp requires the <strong>Pro plan</strong> or higher. Upgrade in Settings → Billing.
          </div>
        )}

        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <p className="text-[13px] text-white font-medium">Enable WhatsApp Channel</p>
            <p className="text-[11.5px] text-[#6a6a6e] mt-0.5">
              Receive and reply to WhatsApp messages with your AI assistant.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isEnabled}
            disabled={!canEnable || !isConfigured}
            onClick={() => setIsEnabled((v) => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0
                        disabled:opacity-40 disabled:cursor-not-allowed
                        ${isEnabled ? 'bg-[#25d366]' : 'bg-white/[0.12]'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow
                              transition-transform ${isEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </label>

        {!isConfigured && (
          <p className="text-[11.5px] text-[#ff8a7a]">
            Set META_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID to enable real WhatsApp messages.
          </p>
        )}

        {/* Phone number / account ID fields */}
        <div className="flex flex-col gap-4 border-t border-white/[0.06] pt-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11.5px] font-semibold text-[#9a9a9d]">
              Display Phone Number (optional)
            </label>
            <input
              type="text"
              value={displayPhone}
              onChange={(e) => setDisplayPhone(e.target.value)}
              placeholder="+1 555-123-4567"
              maxLength={30}
              className="h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3
                         text-[13px] text-white placeholder-[#6a6a6e] outline-none
                         focus:border-[#ff7a18]/40 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11.5px] font-semibold text-[#9a9a9d]">
              WhatsApp Business Account ID (optional)
            </label>
            <input
              type="text"
              value={bizAcctId}
              onChange={(e) => setBizAcctId(e.target.value)}
              placeholder="e.g. 123456789012345"
              maxLength={128}
              className="h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3
                         text-[13px] text-white placeholder-[#6a6a6e] outline-none
                         focus:border-[#ff7a18]/40 transition-colors"
            />
          </div>
        </div>

        {saveErr && <p className="text-[12px] text-[#ff8a7a]">{saveErr}</p>}
        {saveMsg && <p className="text-[12px] text-[#22d093]">{saveMsg}</p>}

        <button
          type="button"
          onClick={handleSave}
          disabled={savePending || !canEnable}
          className="self-start flex items-center gap-1.5 h-9 px-4 rounded-[10px] text-[13px]
                     bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] font-medium
                     hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {savePending
            ? <><span className="w-3.5 h-3.5 rounded-full border-2 border-[#1a0c00]/30 border-t-[#1a0c00] animate-spin" /> Saving…</>
            : 'Save Settings'
          }
        </button>
      </div>

      {/* Test message */}
      {canEnable && isConfigured && (
        <div className="rounded-2xl border border-white/[0.07] bg-[#0f1012] p-6 flex flex-col gap-4">
          <div>
            <h3 className="text-[13.5px] font-semibold text-white">Send Test Message</h3>
            <p className="text-[12px] text-[#6a6a6e] mt-0.5">
              Send a test message to a WhatsApp number to verify your integration.
            </p>
          </div>

          <div className="flex gap-3">
            <input
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="International format: 18765551234"
              maxLength={20}
              className="flex-1 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3
                         text-[13px] text-white placeholder-[#6a6a6e] outline-none
                         focus:border-[#ff7a18]/40 transition-colors"
            />
            <button
              type="button"
              onClick={handleTestSend}
              disabled={testPending || !testPhone.trim()}
              className="flex items-center gap-1.5 h-9 px-4 rounded-[10px] text-[13px]
                         bg-[#25d366]/12 border border-[#25d366]/30 text-[#25d366] font-medium
                         hover:bg-[#25d366]/20 transition-all
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {testPending
                ? <span className="w-3.5 h-3.5 rounded-full border-2 border-[#25d366]/30 border-t-[#25d366] animate-spin" />
                : 'Send Test'
              }
            </button>
          </div>

          {testErr && <p className="text-[12px] text-[#ff8a7a]">{testErr}</p>}
          {testMsg && <p className="text-[12px] text-[#22d093]">{testMsg}</p>}
        </div>
      )}
    </div>
  )
}
