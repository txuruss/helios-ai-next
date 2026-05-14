'use client'

interface Props {
  primaryColor: string
  botName:      string
  welcomeMsg:   string
}

export default function WidgetPreview({ primaryColor, botName, welcomeMsg }: Props) {
  return (
    <div className="border border-white/10 rounded-2xl p-6">
      <h3 className="text-[16px] font-semibold mb-4">Live Preview</h3>
      <div className="relative bg-gradient-to-br from-[#141518] to-[#0a0b0d] rounded-xl
                      border border-white/[0.06] h-64 overflow-hidden">
        {/* Mock chat message */}
        <div className="absolute inset-0 flex flex-col justify-end p-4 gap-2">
          <div className="flex items-end gap-2">
            <div
              className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] text-white"
              style={{ background: primaryColor }}>
              ✦
            </div>
            <div className="bg-white/[0.06] border border-white/[0.08] rounded-2xl rounded-bl-md px-3 py-2 max-w-[72%]">
              <p className="text-[12px] font-medium text-white mb-0.5">{botName}</p>
              <p className="text-[12px] text-[#9a9a9d] leading-snug">{welcomeMsg}</p>
            </div>
          </div>
        </div>

        {/* FAB */}
        <div
          className="absolute bottom-4 right-4 w-12 h-12 rounded-full flex items-center justify-center text-lg text-white"
          style={{ background: primaryColor, boxShadow: `0 0 20px ${primaryColor}55` }}>
          💬
        </div>

        {/* Powered by badge */}
        <div className="absolute bottom-1 left-0 right-0 text-center text-[10px] text-[#6a6a6e]">
          Powered by Helios AI
        </div>
      </div>
    </div>
  )
}
