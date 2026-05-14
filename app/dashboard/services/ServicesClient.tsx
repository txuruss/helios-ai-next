'use client'

import { useState, useTransition } from 'react'
import { deleteService } from '@/lib/actions/services'
import ServiceModal from './ServiceModal'
import type { Service } from '@/types'

function priceFmt(cents: number | null) {
  if (!cents) return '—'
  return `$${(cents / 100).toFixed(2)}`
}

export default function ServicesClient({ initialServices }: { initialServices: Service[] }) {
  const [services, setServices] = useState<Service[]>(initialServices)
  const [modalService, setModalService] = useState<Service | null | 'new'>(null)
  const [delPending, startDel] = useTransition()

  const handleClose = () => {
    setModalService(null)
    // Reload to pick up server-revalidated data
    window.location.reload()
  }

  const handleDelete = (id: string) => {
    if (!confirm('Delete this service? This cannot be undone.')) return
    startDel(async () => {
      const result = await deleteService(id)
      if (!result.error) {
        setServices((prev) => prev.filter((s) => s.id !== id))
      }
    })
  }

  return (
    <>
      {modalService !== null && (
        <ServiceModal
          service={modalService === 'new' ? null : modalService}
          onClose={handleClose}
        />
      )}

      <div className="flex justify-end mb-4">
        <button
          onClick={() => setModalService('new')}
          className="btn-primary btn-sm">
          + Add Service
        </button>
      </div>

      {services.length === 0 ? (
        <div className="border border-white/10 rounded-2xl p-12 text-center">
          <div className="text-4xl mb-3">✦</div>
          <h3 className="text-[18px] font-semibold mb-2">No services yet</h3>
          <p className="text-[14px] text-[#9a9a9d] mb-5">Add the services you offer so your AI assistant can book them.</p>
          <button onClick={() => setModalService('new')} className="btn-primary btn-sm">
            Add Your First Service
          </button>
        </div>
      ) : (
        <div className="border border-white/10 rounded-2xl overflow-hidden">
          <table className="helios-table">
            <thead>
              <tr>
                <th>Service Name</th>
                <th>Price</th>
                <th>Duration</th>
                <th>Status</th>
                <th className="w-32"></th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="font-medium text-white">{s.name}</div>
                    {s.description && <div className="text-[12px] text-[#6a6a6e] mt-0.5 truncate max-w-[280px]">{s.description}</div>}
                  </td>
                  <td className="font-mono text-[#ffae3c]">{priceFmt(s.price_cents)}</td>
                  <td className="text-[#9a9a9d]">{s.duration_min ? `${s.duration_min} min` : '—'}</td>
                  <td>
                    <span className={`pill ${s.is_active ? 'pill-green' : 'pill-mute'}`}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setModalService(s)}
                        className="h-7 px-3 rounded-lg text-[12px] border border-white/10 bg-white/[0.02] text-[#9a9a9d] hover:text-white hover:border-white/[0.18] transition-all">
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        disabled={delPending}
                        className="h-7 px-3 rounded-lg text-[12px] border border-[#ff6a5a]/20 text-[#ff8a7a] hover:bg-[#ff6a5a]/10 hover:border-[#ff6a5a]/40 transition-all disabled:opacity-40">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
