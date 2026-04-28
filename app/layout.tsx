import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mint — CSS Audit & Design System Generator',
  description: 'Audit your legacy CSS, curate the chaos, and generate a clean design system exportable to CSS, Tailwind, SCSS, React, Vue, Svelte, and more.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
