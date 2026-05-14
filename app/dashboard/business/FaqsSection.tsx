'use client'

import { useActionState, useState, useTransition } from 'react'
import { createFaq, updateFaq, deleteFaq } from '@/lib/actions/faqs'
import type { FAQ } from '@/types'

const fieldCls =
  'w-full rounded-[10px] border border-white/10 bg-white/[0.025] px-3.5 text-[14px] text-white ' +
  'placeholder:text-[#6a6a6e] outline-none transition-all ' +
  'focus:border-[#ff7a18]/50 focus:bg-[#ff7a18]/[0.04] disabled:opacity-50'
const labelCls = 'text-[12px] font-medium uppercase tracking-[0.1em] text-[#6a6a6e] mb-1.5 block'

function FaqRow({ faq, onDeleted }: { faq: FAQ; onDeleted: (id: string) => void }) {
  const [editing, setEditing] = useState(false)
  const action = updateFaq.bind(null, faq.id)
  const [state, formAction, pending] = useActionState(action, {})
  const [delPending, startDel] = useTransition()

  if (state.success && editing) setEditing(false)

  return (
    <div className="border border-white/10 rounded-xl p-4">
      {editing ? (
        <form action={formAction} className="flex flex-col gap-3">
          {state.error && <p className="text-[12px] text-[#ff8a7a]">{state.error}</p>}
          <div>
            <label className={labelCls}>Question *</label>
            <input name="question" type="text" defaultValue={faq.question} required className={fieldCls + ' h-[42px]'} disabled={pending} />
          </div>
          <div>
            <label className={labelCls}>Answer *</label>
            <textarea name="answer" rows={3} defaultValue={faq.answer} required
              className={fieldCls + ' py-2.5 resize-none'} disabled={pending} />
          </div>
          <input name="is_active" type="hidden" value={faq.is_active ? 'true' : 'false'} />
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={pending}
              className="h-8 px-3 rounded-lg text-[12.5px] bg-[#ff7a18]/12 border border-[#ff7a18]/30 text-[#ffae3c] hover:bg-[#ff7a18]/20 transition-all disabled:opacity-50">
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setEditing(false)}
              className="h-8 px-3 rounded-lg text-[12.5px] border border-white/10 text-[#9a9a9d] hover:text-white transition-all">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`pill text-[10px] ${faq.is_active ? 'pill-green' : 'pill-mute'}`}>
                {faq.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-[14px] font-medium text-white mb-1">{faq.question}</p>
            <p className="text-[13px] text-[#9a9a9d] leading-relaxed line-clamp-2">{faq.answer}</p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => setEditing(true)}
              className="h-7 px-3 rounded-lg text-[12px] border border-white/10 bg-white/[0.02] text-[#9a9a9d] hover:text-white hover:border-white/[0.18] transition-all">
              Edit
            </button>
            <button
              disabled={delPending}
              onClick={() =>
                startDel(async () => {
                  const r = await deleteFaq(faq.id)
                  if (!r.error) onDeleted(faq.id)
                })
              }
              className="h-7 px-3 rounded-lg text-[12px] border border-[#ff6a5a]/20 text-[#ff8a7a] hover:bg-[#ff6a5a]/10 hover:border-[#ff6a5a]/40 transition-all disabled:opacity-40">
              {delPending ? '…' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function AddFaqForm({ onAdded }: { onAdded: () => void }) {
  const [state, formAction, pending] = useActionState(createFaq, {})

  if (state.success) {
    onAdded()
    return null
  }

  return (
    <form action={formAction} className="border border-[#ff7a18]/20 rounded-xl p-4 flex flex-col gap-3 bg-[#ff7a18]/[0.03]">
      <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#ffae3c]">Add FAQ</div>
      {state.error && <p className="text-[12px] text-[#ff8a7a]">{state.error}</p>}
      <div>
        <label className={labelCls}>Question *</label>
        <input name="question" type="text" required placeholder="What are your hours?" className={fieldCls + ' h-[42px]'} disabled={pending} />
      </div>
      <div>
        <label className={labelCls}>Answer *</label>
        <textarea name="answer" rows={3} required placeholder="We're open Monday–Saturday 9am–5pm." className={fieldCls + ' py-2.5 resize-none'} disabled={pending} />
      </div>
      <input name="is_active" type="hidden" value="true" />
      <div className="flex justify-end">
        <button type="submit" disabled={pending}
          className="h-8 px-4 rounded-lg text-[12.5px] bg-[#ff7a18]/12 border border-[#ff7a18]/30 text-[#ffae3c] hover:bg-[#ff7a18]/20 transition-all disabled:opacity-50">
          {pending ? 'Adding…' : 'Add FAQ'}
        </button>
      </div>
    </form>
  )
}

export default function FaqsSection({ initialFaqs }: { initialFaqs: FAQ[] }) {
  const [faqs, setFaqs] = useState<FAQ[]>(initialFaqs)
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div className="border border-white/10 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/[0.06]">
        <div>
          <h3 className="text-[16px] font-semibold">Knowledge Base / FAQs</h3>
          <p className="text-[13px] text-[#9a9a9d] mt-0.5">Common questions your AI assistant will answer automatically.</p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="h-8 px-4 rounded-[10px] text-[12.5px] bg-[#ff7a18]/12 border border-[#ff7a18]/30 text-[#ffae3c] hover:bg-[#ff7a18]/20 transition-all">
          {showAdd ? 'Cancel' : '+ Add FAQ'}
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {showAdd && (
          <AddFaqForm onAdded={() => { setShowAdd(false); window.location.reload() }} />
        )}

        {faqs.length === 0 && !showAdd ? (
          <div className="text-center py-10">
            <div className="text-3xl mb-2">💬</div>
            <p className="text-[14px] text-[#6a6a6e]">No FAQs yet. Add your first question.</p>
          </div>
        ) : (
          faqs.map((faq) => (
            <FaqRow
              key={faq.id}
              faq={faq}
              onDeleted={(id) => setFaqs((prev) => prev.filter((f) => f.id !== id))}
            />
          ))
        )}
      </div>
    </div>
  )
}
