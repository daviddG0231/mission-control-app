'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './sidebar'
import Header from './header'

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Default to true to prevent flash of desktop layout on mobile
  const [isMobile, setIsMobile] = useState(true)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    setMounted(true)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    if (isMobile) setSidebarOpen(false)
  }, [pathname, isMobile])

  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  const toggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), [])

  // Prevent layout flash before hydration
  if (!mounted) {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-1">{children}</main>
      </div>
    )
  }

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      {isMobile ? (
        // Mobile: slide-in drawer, completely off-screen when closed
        <div
          className="fixed top-0 left-0 bottom-0 z-[70] w-[220px] transition-transform duration-300 ease-out"
          style={{ transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)' }}
        >
          <Sidebar onNavigate={closeSidebar} />
        </div>
      ) : (
        // Desktop: always visible
        <Sidebar onNavigate={closeSidebar} />
      )}

      {/* Main content */}
      <div className={`${isMobile ? 'ml-0' : 'ml-[220px]'} min-h-screen flex flex-col`}>
        <Header onMenuToggle={toggleSidebar} isMobile={isMobile} />
        <main className="flex-1 overflow-x-hidden">
          {children}
        </main>
      </div>
    </>
  )
}
