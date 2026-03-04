import { LucideIcon } from 'lucide-react'

interface PlaceholderPageProps {
  title: string
  description: string
  icon: LucideIcon
}

export default function PlaceholderPage({ title, description, icon: Icon }: PlaceholderPageProps) {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Icon className="w-6 h-6 text-[var(--accent)]" />
          {title}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{description}</p>
      </div>
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-16 text-center">
        <Icon className="w-12 h-12 text-[var(--text-secondary)] mx-auto mb-4 opacity-20" />
        <h2 className="text-lg font-semibold text-white mb-2">Coming Soon</h2>
        <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
          This module is under development. It will be available in a future update.
        </p>
      </div>
    </div>
  )
}
