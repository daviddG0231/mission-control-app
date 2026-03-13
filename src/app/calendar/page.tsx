'use client'

import { useState, useMemo } from 'react'
import { useGatewayData } from '@/hooks/use-gateway'
import { Calendar, Clock, RefreshCw, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CronJob {
  id?: string
  jobId?: string
  name?: string
  enabled?: boolean
  agentId?: string
  schedule?: {
    kind?: string
    expr?: string
    everyMs?: number
    at?: string
    tz?: string
  }
  payload?: {
    kind?: string
    text?: string
    message?: string
    model?: string
    timeoutSeconds?: number
  }
  sessionTarget?: string
  state?: {
    nextRunAtMs?: number
    lastRunAtMs?: number
    lastStatus?: string
    lastDurationMs?: number
    consecutiveErrors?: number
  }
}

interface CronResponse {
  jobs?: CronJob[]
  result?: { jobs?: CronJob[] }
}

interface CalendarEvent {
  job: CronJob
  time: { hour: number; minute: number }
  dayOfWeek?: number // 0-6 for weekly recurring
}

function parseCronExpression(expr: string): CalendarEvent['time'] | null {
  // Parse basic cron: "minute hour * * dayofweek" or "minute hour * * *"
  const parts = expr.trim().split(/\s+/)
  if (parts.length < 2) return null
  
  const minute = parseInt(parts[0])
  const hour = parseInt(parts[1])
  
  if (isNaN(minute) || isNaN(hour)) return null
  if (minute < 0 || minute > 59 || hour < 0 || hour > 23) return null
  
  return { hour, minute }
}

function getAgentColor(agentId?: string) {
  switch (agentId?.toLowerCase()) {
    case 'builder':
      return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
    case 'advisor':
      return 'bg-green-500/15 text-green-400 border-green-500/30'
    default:
      return 'bg-[var(--accent)]/15 text-[var(--accent-hover)] border-[var(--accent)]/30'
  }
}

function formatTime(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
}

function getWeekDates(currentDate: Date): Date[] {
  const week = []
  const startOfWeek = new Date(currentDate)
  const day = startOfWeek.getDay()
  const diff = startOfWeek.getDate() - day // Sunday as start of week
  
  startOfWeek.setDate(diff)
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek)
    date.setDate(startOfWeek.getDate() + i)
    week.push(date)
  }
  
  return week
}

function isToday(date: Date): boolean {
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

function formatDate(date: Date): string {
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatDayName(date: Date): string {
  return date.toLocaleDateString([], { weekday: 'short' })
}

export default function CalendarPage() {
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [selectedJob, setSelectedJob] = useState<CronJob | null>(null)
  
  const { data, loading, error, refetch } = useGatewayData<CronResponse>(
    '/api/gateway/cron',
    30000
  )

  const jobs: CronJob[] = useMemo(() => data?.jobs || data?.result?.jobs || [], [data])
  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek])

  const calendarEvents = useMemo(() => {
    const events: CalendarEvent[] = []
    
    jobs.forEach(job => {
      if (!job.schedule?.expr || job.schedule.kind !== 'cron') return
      
      const time = parseCronExpression(job.schedule.expr)
      if (!time) return
      
      // For simplicity, we'll show all cron jobs on every day
      // In a real implementation, you'd parse the day-of-week part of cron
      events.push({ job, time })
    })
    
    return events.sort((a, b) => {
      if (a.time.hour !== b.time.hour) return a.time.hour - b.time.hour
      return a.time.minute - b.time.minute
    })
  }, [jobs])

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeek)
    newDate.setDate(currentWeek.getDate() + (direction === 'next' ? 7 : -7))
    setCurrentWeek(newDate)
  }

  const goToToday = () => {
    setCurrentWeek(new Date())
  }

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6 overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-white flex items-center gap-2 md:gap-3">
            <Calendar className="w-6 h-6 text-[var(--accent)]" />
            Cron Calendar
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Weekly view of scheduled cron jobs and their run times
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] hover:bg-[var(--bg-hover)] transition text-sm text-[var(--text-secondary)]"
          >
            Today
          </button>
          <button
            onClick={refetch}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] hover:bg-[var(--bg-hover)] transition text-sm text-[var(--text-secondary)]"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
        <button
          onClick={() => navigateWeek('prev')}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)] transition text-sm text-[var(--text-secondary)]"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>
        
        <div className="text-lg font-semibold text-white">
          {weekDates[0] && weekDates[6] && (
            <>
              {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
            </>
          )}
        </div>
        
        <button
          onClick={() => navigateWeek('next')}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)] transition text-sm text-[var(--text-secondary)]"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-lg p-4">
          <p className="text-sm text-[var(--danger)]">⚠️ {error}</p>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-[var(--border)]">
          {weekDates.map((date, index) => (
            <div
              key={index}
              className={cn(
                "p-4 text-center border-r border-[var(--border)] last:border-r-0",
                isToday(date) ? "bg-[var(--accent)]/10" : ""
              )}
            >
              <div className="font-medium text-white text-sm">
                {formatDayName(date)}
              </div>
              <div className={cn(
                "text-xs mt-1",
                isToday(date) ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"
              )}>
                {formatDate(date)}
              </div>
            </div>
          ))}
        </div>

        {/* Calendar Body */}
        <div className="grid grid-cols-7 min-h-[400px] overflow-x-auto">
          {weekDates.map((date, dayIndex) => (
            <div
              key={dayIndex}
              className={cn(
                "p-1 md:p-3 border-r border-[var(--border)] last:border-r-0 space-y-1 md:space-y-2 min-w-[52px]",
                isToday(date) ? "bg-[var(--accent)]/5" : ""
              )}
            >
              {calendarEvents.map((event, eventIndex) => (
                <div
                  key={`${dayIndex}-${eventIndex}`}
                  onClick={() => setSelectedJob(event.job)}
                  className={cn(
                    "p-2 rounded-lg border text-xs cursor-pointer transition hover:scale-105",
                    getAgentColor(event.job.agentId),
                    !event.job.enabled && "opacity-50"
                  )}
                >
                  <div className="font-medium truncate">
                    {event.job.name || event.job.id || 'Unnamed Job'}
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-[10px] opacity-75">
                    <Clock className="w-3 h-3" />
                    {formatTime(event.time.hour, event.time.minute)}
                  </div>
                  {event.job.agentId && (
                    <div className="text-[9px] uppercase tracking-wider mt-1 opacity-60">
                      {event.job.agentId}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {loading && jobs.length === 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-12 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-[var(--text-secondary)]">Loading cron jobs...</p>
        </div>
      )}

      {!loading && jobs.length === 0 && !error && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-12 text-center">
          <Clock className="w-10 h-10 text-[var(--text-secondary)] mx-auto mb-3 opacity-40" />
          <p className="text-sm text-[var(--text-secondary)]">No cron jobs configured</p>
        </div>
      )}

      {/* Job Details Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 max-w-md w-full">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                  selectedJob.enabled !== false ? 'bg-[var(--success)]/15' : 'bg-[var(--text-secondary)]/15'
                )}>
                  {selectedJob.enabled !== false ? (
                    <Play className="w-5 h-5 text-[var(--success)]" />
                  ) : (
                    <Pause className="w-5 h-5 text-[var(--text-secondary)]" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {selectedJob.name || selectedJob.id || 'Unnamed Job'}
                  </h3>
                  {selectedJob.agentId && (
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-full mt-1 inline-block",
                      getAgentColor(selectedJob.agentId)
                    )}>
                      {selectedJob.agentId}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-[var(--text-secondary)] hover:text-white transition"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 text-sm">
              {selectedJob.schedule?.expr && (
                <div>
                  <span className="text-[var(--text-secondary)]">Schedule:</span>
                  <span className="text-white ml-2">{selectedJob.schedule.expr}</span>
                  {selectedJob.schedule.tz && (
                    <span className="text-[var(--text-secondary)] ml-1">({selectedJob.schedule.tz})</span>
                  )}
                </div>
              )}

              {selectedJob.state?.nextRunAtMs && (
                <div>
                  <span className="text-[var(--text-secondary)]">Next Run:</span>
                  <span className="text-white ml-2">
                    {new Date(selectedJob.state.nextRunAtMs).toLocaleString()}
                  </span>
                </div>
              )}

              {selectedJob.state?.lastRunAtMs && (
                <div>
                  <span className="text-[var(--text-secondary)]">Last Run:</span>
                  <span className="text-white ml-2">
                    {new Date(selectedJob.state.lastRunAtMs).toLocaleString()}
                  </span>
                </div>
              )}

              {selectedJob.state?.lastStatus && (
                <div>
                  <span className="text-[var(--text-secondary)]">Last Status:</span>
                  <span className={cn(
                    "ml-2 px-2 py-1 rounded text-xs",
                    selectedJob.state.lastStatus === 'ok' 
                      ? 'bg-[var(--success)]/15 text-[var(--success)]' 
                      : 'bg-[var(--danger)]/15 text-[var(--danger)]'
                  )}>
                    {selectedJob.state.lastStatus}
                  </span>
                </div>
              )}

              {(selectedJob.payload?.text || selectedJob.payload?.message) && (
                <div>
                  <span className="text-[var(--text-secondary)]">Task:</span>
                  <p className="text-white mt-1 text-xs leading-relaxed">
                    {selectedJob.payload.text || selectedJob.payload.message}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}