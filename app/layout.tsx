import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SZPT — Peak Blueprint',
  description: 'Your personal cutting dashboard',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  themeColor: '#050d1a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
