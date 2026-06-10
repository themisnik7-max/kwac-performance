import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'KWAC Performance OS',
  description: 'KW Greece Performance Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el">
      <body style={{ margin: 0, padding: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#f8f8f7' }}>
        {children}
      </body>
    </html>
  )
}