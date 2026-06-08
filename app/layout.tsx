import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'KWAC Performance OS',
  description: 'Real Estate Performance Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="el">
      <body>{children}</body>
    </html>
  )
}