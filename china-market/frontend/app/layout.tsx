import type { Metadata } from 'next'
import './globals.css'
import ErrorBoundary from '@/components/ErrorBoundary'

export const metadata: Metadata = {
  title: 'CEDAR AI - 智能投资决策系统',
  description: '基于多维度数据分析的AI投资决策辅助系统',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="bg-mesh min-h-screen antialiased">
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  )
}
