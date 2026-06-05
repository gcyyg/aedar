'use client'
import { Component, ReactNode } from 'react'

export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error: Error) {
    console.warn('ErrorBoundary caught:', error.message)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-white/50 text-sm">页面渲染中...</div>
        </div>
      )
    }
    return this.props.children
  }
}
