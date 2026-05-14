import type { Metadata } from 'next'
import { Poppins, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Helios AI | AI Booking Systems for Local Businesses',
    template: '%s | Helios AI',
  },
  description:
    'Helios AI builds AI booking systems, lead capture flows, WhatsApp automations, client onboarding systems, and operations dashboards for local service businesses.',
  keywords: ['AI booking', 'lead capture', 'WhatsApp automation', 'local business', 'operations dashboard'],
  openGraph: {
    type: 'website',
    siteName: 'Helios AI',
    title: 'Turn Missed Messages Into Booked Customers',
    description:
      'AI booking systems, lead capture, WhatsApp automation, and operations dashboards for local service businesses.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Turn Missed Messages Into Booked Customers',
    description:
      'AI booking systems, lead capture, WhatsApp automation, and operations dashboards for local service businesses.',
  },
  themeColor: '#0a0a0c',
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${poppins.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
