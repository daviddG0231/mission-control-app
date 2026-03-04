'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Bot,
  KanbanSquare,
  Brain,
  Clock,
  MessageSquare,
  Zap,
  FileText,
  ShieldCheck,
  Users,
  Calendar,
  FolderOpen,
  BookOpen,
  UserCircle,
  Building2,
  UsersRound,
  Monitor,
  Radar,
  GitBranch,
  MessageCircle,
  TerminalSquare,
  Settings2,
  Bug,
  ScrollText,
  Coins,
  Play,
  KeyRound,
} from 'lucide-react'

const NAV_SECTIONS = [
  {
    items: [
      { label: 'Tasks', href: '/tasks', icon: KanbanSquare },
      { label: 'Agents', href: '/agents', icon: Bot },
      { label: 'Sessions', href: '/sessions', icon: MessageSquare },
      { label: 'Cron Jobs', href: '/cron', icon: Clock },
      { label: 'Content', href: '/content', icon: FileText },
      { label: 'Approvals', href: '/approvals', icon: ShieldCheck },
      { label: 'Council', href: '/council', icon: Users },
    ],
  },
  {
    items: [
      { label: 'Calendar', href: '/calendar', icon: Calendar },
      { label: 'Projects', href: '/projects', icon: FolderOpen },
      { label: 'Memory', href: '/memory', icon: Brain },
      { label: 'Docs', href: '/docs', icon: BookOpen },
    ],
  },
  {
    items: [
      { label: 'People', href: '/people', icon: UserCircle },
      { label: 'Agent Office', href: '/office', icon: Building2 },
      { label: 'Team', href: '/team', icon: UsersRound },
    ],
  },
  {
    items: [
      { label: 'Terminal', href: '/terminal', icon: TerminalSquare },
      { label: 'Commands', href: '/commands', icon: Play },
      { label: 'Config', href: '/config', icon: Settings2 },
      { label: 'Logs', href: '/logs', icon: ScrollText },
      { label: 'Usage', href: '/usage', icon: Coins },
      { label: 'Secrets', href: '/secrets', icon: KeyRound },
      { label: 'Debug', href: '/debug', icon: Bug },
      { label: 'System', href: '/system', icon: Monitor },
      { label: 'Radar', href: '/radar', icon: Radar },
      { label: 'Pipeline', href: '/pipeline', icon: GitBranch },
      { label: 'Feedback', href: '/feedback', icon: MessageCircle },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[220px] bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col z-50">
      {/* Logo */}
      <Link href="/" className="block px-4 py-4 border-b border-[var(--border)] hover:bg-white/[0.04] transition">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[var(--accent)] rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-none">Mission Control</h1>
            <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">OpenClaw Dashboard</p>
          </div>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto space-y-3">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} className={cn(si > 0 && 'pt-2 border-t border-[var(--border)]/50')}>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== '/' && pathname.startsWith(item.href))
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium transition-all',
                      isActive
                        ? 'bg-white/[0.08] text-white'
                        : 'text-[#8a8a9a] hover:bg-white/[0.04] hover:text-[#c4c4d0]'
                    )}
                  >
                    <Icon className="w-[16px] h-[16px]" />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Status */}
      <div className="px-3 py-3 border-t border-[var(--border)]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
          <span className="text-[11px] text-[var(--text-secondary)]">Gateway Connected</span>
        </div>
        <div className="text-[10px] text-[var(--text-secondary)] mt-0.5 pl-4">
          Port 18789 · 2 agents
        </div>
      </div>
    </aside>
  )
}
