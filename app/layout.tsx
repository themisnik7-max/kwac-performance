import type { Metadata } from 'next'
import './globals.css'
import AppShell from '../components/AppShell'
import { AppProvider } from '../lib/AppContext'

export const metadata: Metadata = {
  title: 'KWAC Performance OS',
  description: 'Real Estate Intelligence',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el">
      <body style={{ display: 'flex', minHeight: '100vh', background: '#0d0d0d', margin: 0 }}>
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  )
}