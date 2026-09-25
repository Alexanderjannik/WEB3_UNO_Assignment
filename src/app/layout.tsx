import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'UNO',
  description: 'Play UNO against bots or with other players online.'
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>)
{
  return <html lang="en">
    <body>{children}</body>
  </html>
}
