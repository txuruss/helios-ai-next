'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { PRICING_TIERS } from '@/lib/constants'
import { cn } from '@/components/ui/cn'
import { capture } from '@/lib/analytics/posthog'

export default function PricingSection() {
  return (
    <section className="section-base" id="pricing">
      <div className="max-w-[1280px] mx-auto px-7 border-t border-white/[0.06] pt-28">
        <div className="flex flex-col gap-3.5 mb-14 max-w-[760px]">
          <span className="eyebrow">Pricing</span>
          <h2 className="text-[clamp(28px,3.5vw,44px)] font-semibold tracking-tight leading-[1.08]">
            Choose the system that fits your business.
          </h2>
          <p className="text-[16px] text-[#9a9a9d]">
            All packages start with a free demo so you know exactly what you&apos;re getting before committing to anything.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {PRICING_TIERS.map((tier, i) => (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
              onClick={() => capture('pricing_plan_viewed', { plan: tier.id })}
              className={cn(
                'relative rounded-3xl p-8 flex flex-col gap-5 border transition-all duration-300',
                tier.featured
                  ? 'border-[#ff7a18]/55 bg-gradient-to-b from-[#ff7a18]/13 to-[#0f1012]/85 shadow-[0_50px_100px_-30px_rgba(255,122,24,0.55),0_0_0_1px_rgba(255,122,24,0.18)]'
                  : 'border-white/10 bg-[#0f1012]/60 hover:border-white/[0.14] hover:-translate-y-1',
              )}
            >
              {'badge' in tier && tier.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-semibold px-4 py-1.5 rounded-full
                                  bg-gradient-to-b from-[#ff8a2a] to-[#ee6a0c] text-[#1a0c00] tracking-[0.04em] whitespace-nowrap">
                  {tier.badge as string}
                </span>
              )}

              {/* Name */}
              <div>
                <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#ffae3c]">
                  {tier.name}
                </div>
                <p className="text-[14px] text-[#9a9a9d] mt-1">{tier.tagline}</p>
              </div>

              {/* Price ranges */}
              {'setupRange' in tier && (
                <div className="border-y border-white/[0.06] py-3.5 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6a6a6e]">Setup</span>
                    <span className="font-mono text-white font-medium">{tier.setupRange as string}</span>
                  </div>
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#6a6a6e]">Monthly</span>
                    <span className="font-mono text-[#ffae3c] font-medium">{tier.monthlyRange as string}</span>
                  </div>
                </div>
              )}

              {/* Best for */}
              {'bestFor' in tier && tier.bestFor && (
                <div className="p-2.5 rounded-xl bg-white/[0.025] border border-white/[0.06]">
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#6a6a6e]">Best for</span>
                  <p className="text-[13px] text-[#f3f3f3] mt-0.5">{tier.bestFor as string}</p>
                </div>
              )}

              {/* Features */}
              <div>
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#6a6a6e] mb-3">
                  Includes
                </div>
                <ul className="flex flex-col gap-2.5 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex gap-2.5 items-start text-[13.5px] text-[#f3f3f3]">
                      <span className="w-3.5 h-3.5 rounded-full border border-[#ff7a18]/40
                                        bg-[radial-gradient(circle,#ff7a18_30%,transparent_35%)]
                                        bg-[#ff7a18]/15 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Outcome */}
              <div className="p-3.5 rounded-xl bg-[#ff7a18]/[0.08] border border-[#ff7a18]/20 flex flex-col gap-1 mt-auto">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#ffae3c]">Goal</div>
                <div className="text-[13.5px] text-white">{tier.outcome}</div>
              </div>

              <Link
                href="/login"
                onClick={() => capture('landing_cta_clicked', { source: 'pricing', plan: tier.id, cta: tier.cta })}
                className={cn(
                  'inline-flex items-center justify-center h-12 px-6 rounded-full font-semibold text-[14px] transition-all',
                  tier.featured ? 'btn-primary' : 'btn-ghost',
                )}
              >
                {tier.cta}
              </Link>
            </motion.div>
          ))}
        </div>

        <p className="text-center mt-7 text-[13px] text-[#6a6a6e]">
          Flat public pricing keeps setup simple. Custom requirements, extra locations, advanced workflows, or complex integrations may require add-ons.
        </p>
        <div className="mt-4 max-w-[640px] mx-auto flex items-start gap-2.5 p-4 rounded-xl
                        bg-white/[0.02] border border-white/[0.06] text-[13px] text-[#9a9a9d]">
          <svg className="text-[#ffae3c] shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 14 9l7 2-7 2-2 7-2-7-7-2 7-2 2-7Z"/></svg>
          Not sure which system fits? Book a free demo — we&apos;ll review your workflow and recommend the right plan.
        </div>
      </div>
    </section>
  )
}
