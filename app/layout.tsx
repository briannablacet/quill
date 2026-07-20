import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Toaster } from '@/components/ui/sonner'
import { Nav } from '@/components/quill/nav'
import { AssistantWidget } from '@/components/quill/assistant-widget'
import { getUserId } from '@/lib/session'
import { getCompanyProfile } from '@/lib/agents/company-profile'
import './globals.css'

export const metadata: Metadata = {
  title: 'Quill - Agentic Content Marketing OS',
  description:
    'Quill writes, grades, and improves marketing content on its own — a real task queue, a writer agent, and an evaluator that catches and fixes its own mistakes.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: '#e7e5dd',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const userId = await getUserId()
  const companyProfile = userId ? await getCompanyProfile(userId) : null

  return (
    <html lang="en">
      <body className="bg-background text-foreground antialiased">
        <Nav companyName={companyProfile?.companyName} />
        {children}
        {userId && <AssistantWidget />}
        <Toaster position="bottom-left" />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
