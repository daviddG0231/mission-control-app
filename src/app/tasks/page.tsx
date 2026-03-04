'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import LiveActivity from '@/components/live-activity'

interface Task {
  id: string
  title: string
  description?: string
  agent?: { name: string; emoji: string; color: string }
  project?: { name: string; color: string }
  priority?: 'low' | 'medium' | 'high'
  timestamp?: string
}

interface Column {
  id: string
  label: string
  color: string
  tasks: Task[]
}

const PATRICK = { name: 'Patrick', emoji: '🪼', color: '#6366f1' }
const SUBAGENT = { name: 'Sub-agent', emoji: '⚡', color: '#f59e0b' }

const INITIAL_COLUMNS: Column[] = [
  {
    id: 'recurring',
    label: 'Recurring',
    color: '#71717a',
    tasks: [],
  },
  {
    id: 'backlog',
    label: 'Backlog',
    color: '#71717a',
    tasks: [
      { id: '1', title: 'Quiz system UI', description: 'Build quiz creation and taking interface for students and teachers', agent: PATRICK, project: { name: 'TutorFlow', color: '#6366f1' }, priority: 'medium', timestamp: 'less than a minute' },
      { id: '2', title: 'Settings page', description: 'User profile, preferences, and account settings', project: { name: 'TutorFlow', color: '#6366f1' }, priority: 'low' },
      { id: '3', title: 'Course scheduling', description: 'Calendar-based scheduling for courses and classes', project: { name: 'TutorFlow', color: '#6366f1' }, priority: 'low' },
      { id: '14', title: 'Deploy MC to Vercel', description: 'Set up production deployment for Mission Control', agent: PATRICK, project: { name: 'Mission Control', color: '#ec4899' }, priority: 'medium' },
    ],
  },
  {
    id: 'in-progress',
    label: 'In Progress',
    color: '#6366f1',
    tasks: [
      { id: '4', title: 'Mission Control Dashboard', description: 'Build the MC app with live gateway connection and all features', agent: PATRICK, project: { name: 'Mission Control', color: '#ec4899' }, priority: 'high', timestamp: 'less than a minute' },
      { id: '5', title: 'Student dashboard widgets', description: 'Real data widgets for student view', agent: SUBAGENT, project: { name: 'TutorFlow', color: '#6366f1' }, priority: 'high', timestamp: 'less than a minute' },
      { id: '6', title: 'Notification system', description: 'Bell icon with real unread count + dropdown notifications', agent: SUBAGENT, project: { name: 'TutorFlow', color: '#6366f1' }, priority: 'high' },
    ],
  },
  {
    id: 'review',
    label: 'Review',
    color: '#f59e0b',
    tasks: [
      { id: '7', title: 'Mobile responsive', description: 'Hamburger menu sidebar on mobile screens', agent: SUBAGENT, project: { name: 'TutorFlow', color: '#6366f1' }, priority: 'medium' },
      { id: '8', title: 'Grading flow', description: 'Full grading: view submissions, grade with feedback, student sees results', agent: SUBAGENT, project: { name: 'TutorFlow', color: '#6366f1' }, priority: 'high' },
    ],
  },
  {
    id: 'done',
    label: 'Done',
    color: '#22c55e',
    tasks: [
      { id: '9', title: 'Sidebar navigation', agent: PATRICK, project: { name: 'TutorFlow', color: '#6366f1' } },
      { id: '10', title: 'Content upload system', agent: PATRICK, project: { name: 'TutorFlow', color: '#6366f1' } },
      { id: '11', title: 'Teacher dashboard', agent: PATRICK, project: { name: 'TutorFlow', color: '#6366f1' } },
      { id: '12', title: 'Module management', agent: PATRICK, project: { name: 'TutorFlow', color: '#6366f1' } },
      { id: '13', title: 'Inline content viewer', agent: PATRICK, project: { name: 'TutorFlow', color: '#6366f1' } },
    ],
  },
]

const AGENTS_FILTER = [
  { name: 'Patrick', emoji: '🪼' },
  { name: 'Dave', emoji: '💭' },
]

const PIPELINE_ORDER = ['backlog', 'in-progress', 'review', 'done']

export default function TasksPage() {
  const [columns, setColumns] = useState<Column[]>(INITIAL_COLUMNS)
  const [loaded, setLoaded] = useState(false)
  const [draggedTask, setDraggedTask] = useState<{ taskId: string; fromCol: string } | null>(null)

  // Load from server on mount
  useEffect(() => {
    fetch('/api/tasks')
      .then((r) => r.json())
      .then((data) => {
        if (data && Array.isArray(data) && data.length > 0) setColumns(data)
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  // Save to server whenever columns change (after initial load)
  const saveColumns = useCallback((cols: Column[]) => {
    if (!loaded) return
    fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cols),
    }).catch(() => {})
  }, [loaded])

  useEffect(() => {
    if (loaded) saveColumns(columns)
  }, [columns, loaded, saveColumns])
  const [newTaskCol, setNewTaskCol] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [activeAgent, setActiveAgent] = useState<string | null>(null)
  const [activeProject, setActiveProject] = useState<string>('all')

  function handleDragStart(taskId: string, fromCol: string) {
    setDraggedTask({ taskId, fromCol })
  }

  function handleDrop(toCol: string) {
    if (!draggedTask || draggedTask.fromCol === toCol) {
      setDraggedTask(null)
      return
    }
    setColumns((cols) => {
      const newCols = cols.map((c) => ({ ...c, tasks: [...c.tasks] }))
      const fromIdx = newCols.findIndex((c) => c.id === draggedTask.fromCol)
      const toIdx = newCols.findIndex((c) => c.id === toCol)
      const taskIdx = newCols[fromIdx].tasks.findIndex((t) => t.id === draggedTask.taskId)
      if (taskIdx === -1) return cols
      const [task] = newCols[fromIdx].tasks.splice(taskIdx, 1)
      newCols[toIdx].tasks.push(task)
      return newCols
    })
    setDraggedTask(null)
  }

  function addTask(colId: string) {
    if (!newTaskTitle.trim()) return
    setColumns((cols) =>
      cols.map((c) =>
        c.id === colId
          ? { ...c, tasks: [...c.tasks, { id: Date.now().toString(), title: newTaskTitle.trim(), priority: 'medium' as const }] }
          : c
      )
    )
    setNewTaskTitle('')
    setNewTaskCol(null)
  }

  function removeTask(colId: string, taskId: string) {
    setColumns((cols) =>
      cols.map((c) => c.id === colId ? { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) } : c)
    )
  }

  function moveToNext(colId: string, taskId: string) {
    const idx = PIPELINE_ORDER.indexOf(colId)
    if (idx === -1 || idx >= PIPELINE_ORDER.length - 1) return
    const nextColId = PIPELINE_ORDER[idx + 1]
    setColumns((cols) => {
      const newCols = cols.map((c) => ({ ...c, tasks: [...c.tasks] }))
      const fromIdx = newCols.findIndex((c) => c.id === colId)
      const toIdx = newCols.findIndex((c) => c.id === nextColId)
      const taskIdx = newCols[fromIdx]?.tasks.findIndex((t) => t.id === taskId)
      if (fromIdx === -1 || toIdx === -1 || taskIdx === undefined || taskIdx === -1) return cols
      const [task] = newCols[fromIdx].tasks.splice(taskIdx, 1)
      newCols[toIdx].tasks.push(task)
      return newCols
    })
  }

  // Filter tasks
  const filteredColumns = columns.map((col) => ({
    ...col,
    tasks: col.tasks.filter((t) => {
      if (activeAgent && t.agent?.name !== activeAgent) return false
      if (activeProject !== 'all' && t.project?.name !== activeProject) return false
      return true
    }),
  }))

  const totalTasks = columns.reduce((sum, c) => sum + c.tasks.length, 0)
  const doneTasks = columns.find((c) => c.id === 'done')?.tasks.length || 0
  const inProgressCount = columns.find((c) => c.id === 'in-progress')?.tasks.length || 0
  const thisWeek = totalTasks
  const completion = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  const projects = Array.from(new Set(columns.flatMap((c) => c.tasks.map((t) => t.project?.name).filter(Boolean))))

  return (
    <div className="flex h-[calc(100vh-52px)]">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Stats bar */}
        <div className="px-6 pt-5 pb-3">
          <div className="flex items-baseline gap-6">
            <div>
              <span className="text-4xl font-bold text-white">{thisWeek}</span>
              <span className="text-xs text-[var(--text-secondary)] ml-2">This week</span>
            </div>
            <div>
              <span className="text-4xl font-bold text-[var(--accent)]">{inProgressCount}</span>
              <span className="text-xs text-[var(--text-secondary)] ml-2">In progress</span>
            </div>
            <div>
              <span className="text-4xl font-bold text-white">{totalTasks}</span>
              <span className="text-xs text-[var(--text-secondary)] ml-2">Total</span>
            </div>
            <div>
              <span className="text-4xl font-bold text-[var(--success)]">{completion}%</span>
              <span className="text-xs text-[var(--text-secondary)] ml-2">Completion</span>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-6 pb-4 flex items-center gap-2">
          <button
            onClick={() => setNewTaskCol(newTaskCol ? null : 'backlog')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:bg-[var(--accent-hover)] transition"
          >
            <Plus className="w-3.5 h-3.5" />
            New task
          </button>

          {AGENTS_FILTER.map((agent) => (
            <button
              key={agent.name}
              onClick={() => setActiveAgent(activeAgent === agent.name ? null : agent.name)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition',
                activeAgent === agent.name
                  ? 'bg-white/10 text-white'
                  : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-white'
              )}
            >
              {agent.emoji} {agent.name}
            </button>
          ))}

          <select
            value={activeProject}
            onChange={(e) => setActiveProject(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)] text-xs text-[var(--text-secondary)] outline-none"
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Kanban */}
        <div className="flex-1 overflow-x-auto px-6 pb-6">
          <div className="flex gap-4 h-full min-w-max">
            {filteredColumns.map((col) => (
              <div
                key={col.id}
                className="w-[280px] flex flex-col shrink-0"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(col.id)}
              >
                {/* Column header */}
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                  <span className="text-xs font-semibold text-white">{col.label}</span>
                  <span className="text-[10px] text-[var(--text-secondary)] bg-[var(--bg-hover)] px-1.5 py-0.5 rounded">
                    {col.tasks.length}
                  </span>
                  <button
                    onClick={() => setNewTaskCol(newTaskCol === col.id ? null : col.id)}
                    className="ml-auto w-5 h-5 rounded flex items-center justify-center hover:bg-[var(--bg-hover)] transition"
                  >
                    <Plus className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  </button>
                </div>

                {/* Add task form */}
                {newTaskCol === col.id && (
                  <div className="mb-2 p-3 bg-[var(--bg-card)] border border-[var(--accent)]/30 rounded-lg">
                    <input
                      autoFocus
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addTask(col.id)
                        if (e.key === 'Escape') { setNewTaskCol(null); setNewTaskTitle('') }
                      }}
                      placeholder="Task title..."
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[var(--text-secondary)]"
                    />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => addTask(col.id)} className="px-2 py-1 text-[10px] bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] transition">Add</button>
                      <button onClick={() => { setNewTaskCol(null); setNewTaskTitle('') }} className="px-2 py-1 text-[10px] text-[var(--text-secondary)]">Cancel</button>
                    </div>
                  </div>
                )}

                {/* Tasks */}
                <div className="flex-1 space-y-2 overflow-y-auto">
                  {col.tasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task.id, col.id)}
                      className={cn(
                        'bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-[var(--accent)]/20 transition group',
                        draggedTask?.taskId === task.id && 'opacity-40'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-white leading-snug">{task.title}</p>
                          {task.description && (
                            <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 line-clamp-2 leading-relaxed">
                              {task.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
                          {PIPELINE_ORDER.indexOf(col.id) >= 0 && PIPELINE_ORDER.indexOf(col.id) < PIPELINE_ORDER.length - 1 && (
                            <button
                              onClick={() => moveToNext(col.id, task.id)}
                              title="Move to next stage"
                              className="p-0.5 rounded hover:bg-[var(--success)]/20 text-[var(--text-secondary)] hover:text-[var(--success)] transition"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => removeTask(col.id, task.id)} className="p-0.5 rounded hover:bg-[var(--danger)]/20 text-[var(--text-secondary)] hover:text-[var(--danger)] transition">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Bottom row: agent + project */}
                      <div className="flex items-center gap-2 mt-2.5">
                        {task.agent && (
                          <div className="flex items-center gap-1">
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                              style={{ background: `${task.agent.color}25` }}
                            >
                              {task.agent.emoji}
                            </div>
                          </div>
                        )}
                        {task.project && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                            style={{ background: `${task.project.color}20`, color: task.project.color }}
                          >
                            {task.project.name}
                          </span>
                        )}
                        {task.timestamp && (
                          <span className="text-[10px] text-[var(--text-secondary)] ml-auto">{task.timestamp}</span>
                        )}
                      </div>
                    </div>
                  ))}

                  {col.tasks.length === 0 && (
                    <div className="py-8 text-center">
                      <p className="text-[11px] text-[var(--text-secondary)]/50">No tasks</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Activity sidebar */}
      <div className="w-[300px] border-l border-[var(--border)] shrink-0">
        <LiveActivity />
      </div>
    </div>
  )
}
