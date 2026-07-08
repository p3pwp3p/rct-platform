import type { Metadata } from 'next'
import '@/styles/globals.css'
import ThemeProvider from '@/components/ThemeProvider'
import ToastProvider from '@/components/ToastProvider'

export const metadata: Metadata = {
  title: 'RCT Platform',
  description: 'RCT / Aetheris Network Marketing Platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=SUIT:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bg-base text-text-primary font-main antialiased">
        <ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider>
      </body>
    </html>
  )
}
