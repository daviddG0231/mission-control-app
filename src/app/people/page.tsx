'use client'

import { useState, useEffect } from 'react'
import { User, Mail, Globe, UserPlus, Clock, X, Trash2, Bot } from 'lucide-react'

interface Contact {
  id: string
  name: string
  role: string
  email?: string
  timezone: string
  avatar: string
  type: 'human' | 'ai'
  model?: string
  status: 'online' | 'offline' | 'active'
  isPrimary?: boolean
}

const AVATARS = ['🤖', '🧠', '⚡', '🔥', '🪼', '💭', '🦾', '🎯', '🛡️', '🔮', '🌟', '🐙', '👨‍💻', '👤']

export default function PeoplePage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [models, setModels] = useState<{ id: string; label: string }[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [emailModal, setEmailModal] = useState<Contact | null>(null)
  const [emailDraft, setEmailDraft] = useState({ subject: '', body: '' })
  const [emailSending, setEmailSending] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const defaultModel = 'anthropic/claude-sonnet-4-6'
  const [form, setForm] = useState({
    name: '', role: '', email: '', timezone: 'GMT+0 (Global)',
    avatar: '🤖', type: 'ai' as 'human' | 'ai', model: defaultModel, customModel: ''
  })

  const fetchContacts = async () => {
    try {
      const res = await fetch('/api/contacts')
      if (res.ok) {
        const d = await res.json()
        setContacts(d.contacts || [])
      }
    } catch { /* ignore */ }
  }

  const fetchModels = async () => {
    try {
      const res = await fetch('/api/gateway/models')
      if (res.ok) {
        const d = await res.json()
        setModels(d.models || [])
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    fetchContacts()
    fetchModels()
  }, [])

  const [addError, setAddError] = useState<string | null>(null)

  const handleAdd = async () => {
    if (!form.name.trim()) return
    setAddError(null)
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          role: form.role || (form.type === 'ai' ? 'AI Agent' : 'Team Member'),
          email: form.email || undefined,
          timezone: form.timezone,
          avatar: form.avatar,
          type: form.type,
          model: form.type === 'ai' ? form.model : undefined,
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setAddError(data.error || 'Failed to add contact')
        return
      }
      setShowModal(false)
      setForm({ name: '', role: '', email: '', timezone: 'GMT+0 (Global)', avatar: '🤖', type: 'ai', model: models[0]?.id ?? defaultModel, customModel: '' })
      fetchContacts()
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Failed to add contact')
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      await fetch('/api/contacts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      fetchContacts()
    } catch { /* ignore */ }
    setDeleting(null)
  }

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.role.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="p-3 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <User className="w-7 h-7" />
            People
          </h1>
          <p className="text-[var(--text-secondary)] mt-1">Team members and contacts</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setAddError(null) }}
          className="bg-[var(--accent)] text-white px-4 py-2 rounded-lg hover:bg-[var(--accent)]/80 transition flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Add Contact
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search contacts..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-4 py-2 text-white placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] text-sm"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Total Contacts</p>
              <p className="text-2xl font-bold text-white">{contacts.length}</p>
            </div>
            <User className="w-6 h-6 text-[var(--accent)]" />
          </div>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-secondary)]">AI Agents</p>
              <p className="text-2xl font-bold text-white">{contacts.filter(c => c.type === 'ai').length}</p>
            </div>
            <Bot className="w-6 h-6 text-[var(--accent)]" />
          </div>
        </div>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Active Now</p>
              <p className="text-2xl font-bold text-white">{contacts.filter(c => c.status !== 'offline').length}</p>
            </div>
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          </div>
        </div>
      </div>

      {/* Contacts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((c) => (
          <div key={c.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-5 hover:bg-[var(--bg-hover)] transition group relative">
            {/* Delete button */}
            {!c.isPrimary && (
              <button
                onClick={() => handleDelete(c.id)}
                disabled={deleting === c.id}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-[var(--danger)]/15 transition"
                title="Remove"
              >
                <Trash2 className="w-3.5 h-3.5 text-[var(--danger)]" />
              </button>
            )}

            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="text-3xl">{c.avatar}</div>
                <div>
                  <h3 className="font-semibold text-white">{c.name}</h3>
                  <p className="text-sm text-[var(--text-secondary)]">{c.role}</p>
                  {c.model && <p className="text-xs text-[var(--accent)] mt-0.5">{c.model}</p>}
                </div>
              </div>
              <div className={`w-3 h-3 rounded-full ${
                c.status === 'online' ? 'bg-green-500' :
                c.status === 'active' ? 'bg-blue-500 animate-pulse' :
                'bg-gray-500'
              }`} />
            </div>

            <div className="space-y-1.5">
              {c.email && (
                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <Mail className="w-3.5 h-3.5" />
                  <span>{c.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <Clock className="w-3.5 h-3.5" />
                <span>{c.timezone}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <Globe className="w-3.5 h-3.5" />
                <span className="capitalize">{c.type}</span>
                {c.type === 'ai' && <span className="text-[var(--accent)]">• AI Agent</span>}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between">
              <span className={`text-xs px-2 py-0.5 rounded ${
                c.status === 'online' ? 'bg-green-500/20 text-green-400' :
                c.status === 'active' ? 'bg-blue-500/20 text-blue-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {c.status}
              </span>
              {c.type === 'human' && c.email ? (
                <button
                  onClick={() => { setEmailModal(c); setEmailDraft({ subject: '', body: '' }); setEmailError(null) }}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  Contact
                </button>
              ) : (
                <span className="text-xs text-[var(--text-secondary)]/50">Contact</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-[var(--text-secondary)]">No contacts found</div>
      )}

      {/* Email Modal (human contacts) */}
      {emailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-[var(--accent)]" />
                Send email to {emailModal.name}
              </h2>
              <button
                onClick={() => { setEmailModal(null); setEmailDraft({ subject: '', body: '' }); setEmailError(null) }}
                className="p-1 hover:bg-[var(--bg-hover)] rounded"
              >
                <X className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
            </div>

            <div className="space-y-4">
              {emailError && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                  {emailError}
                </div>
              )}
              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">To</label>
                <div className="px-3 py-2 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)] text-sm text-[var(--text-secondary)]">
                  {emailModal.email}
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">Subject</label>
                <input
                  value={emailDraft.subject}
                  onChange={(e) => setEmailDraft((d) => ({ ...d, subject: e.target.value }))}
                  placeholder="Enter subject..."
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-white placeholder:text-[var(--text-secondary)] text-sm focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">Message</label>
                <textarea
                  value={emailDraft.body}
                  onChange={(e) => setEmailDraft((d) => ({ ...d, body: e.target.value }))}
                  placeholder="Write your message..."
                  rows={5}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-white placeholder:text-[var(--text-secondary)] text-sm focus:outline-none focus:border-[var(--accent)] resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setEmailModal(null); setEmailDraft({ subject: '', body: '' }); setEmailError(null) }}
                disabled={emailSending}
                className="px-4 py-2 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)] text-sm text-[var(--text-primary)] hover:bg-[var(--border)]/30 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!emailModal?.email) return
                  setEmailSending(true)
                  setEmailError(null)
                  try {
                    const res = await fetch('/api/email/send', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        to: emailModal.email,
                        subject: emailDraft.subject,
                        body: emailDraft.body,
                      }),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || 'Failed to send')
                    setEmailModal(null)
                    setEmailDraft({ subject: '', body: '' })
                  } catch (e) {
                    setEmailError(e instanceof Error ? e.message : 'Failed to send email')
                  } finally {
                    setEmailSending(false)
                  }
                }}
                disabled={emailSending}
                className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent)]/80 transition disabled:opacity-50 inline-flex items-center gap-2"
              >
                {emailSending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Send via gog
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[var(--accent)]" />
                Add New Contact
              </h2>
              <button onClick={() => { setShowModal(false); setAddError(null) }} className="p-1 hover:bg-[var(--bg-hover)] rounded">
                <X className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
            </div>

            <div className="space-y-4">
              {addError && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                  {addError}
                </div>
              )}
              {/* Type toggle */}
              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">Type</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setForm(f => ({ ...f, type: 'ai', avatar: '🤖' }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                      form.type === 'ai'
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-[var(--border)]'
                    }`}
                  >
                    🤖 AI Agent
                  </button>
                  <button
                    onClick={() => setForm(f => ({ ...f, type: 'human', avatar: '👤' }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                      form.type === 'human'
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-[var(--border)]'
                    }`}
                  >
                    👤 Human
                  </button>
                </div>
              </div>

              {/* Avatar picker */}
              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">Avatar</label>
                <div className="flex flex-wrap gap-2">
                  {AVATARS.map(a => (
                    <button
                      key={a}
                      onClick={() => setForm(f => ({ ...f, avatar: a }))}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition ${
                        form.avatar === a
                          ? 'bg-[var(--accent)]/20 border-2 border-[var(--accent)]'
                          : 'bg-[var(--bg-hover)] border border-[var(--border)] hover:border-[var(--accent)]/50'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={form.type === 'ai' ? 'e.g. Bolt ⚡' : 'e.g. John'}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-white placeholder:text-[var(--text-secondary)] text-sm focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              {/* Role */}
              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">Role</label>
                <input
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  placeholder={form.type === 'ai' ? 'e.g. Code Writer, Researcher, QA Tester' : 'e.g. Designer'}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-white placeholder:text-[var(--text-secondary)] text-sm focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              {/* Model (AI only) */}
              {form.type === 'ai' && (
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">Model</label>
                  <select
                    value={form.model}
                    onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-white text-sm focus:outline-none focus:border-[var(--accent)]"
                  >
                    {models.length > 0 ? (
                      models.map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))
                    ) : (
                      <option value={defaultModel}>Loading models...</option>
                    )}
                  </select>
                </div>
              )}

              {/* Email (Human only) */}
              {form.type === 'human' && (
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">Email</label>
                  <input
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="email@example.com"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-white placeholder:text-[var(--text-secondary)] text-sm focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              )}

              {/* Timezone */}
              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">Timezone</label>
                <select
                  value={form.timezone}
                  onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-white text-sm focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="GMT+0 (Global)">GMT+0 (Global)</option>
                  <option value="GMT+2 (Cairo)">GMT+2 (Cairo)</option>
                  <option value="GMT+3 (Riyadh)">GMT+3 (Riyadh)</option>
                  <option value="GMT-5 (EST)">GMT-5 (EST)</option>
                  <option value="GMT-8 (PST)">GMT-8 (PST)</option>
                  <option value="GMT+1 (CET)">GMT+1 (CET)</option>
                  <option value="GMT+5:30 (IST)">GMT+5:30 (IST)</option>
                  <option value="GMT+8 (SGT)">GMT+8 (SGT)</option>
                  <option value="GMT+9 (JST)">GMT+9 (JST)</option>
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)] text-sm text-[var(--text-primary)] hover:bg-[var(--border)]/30 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!form.name.trim()}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  form.name.trim()
                    ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent)]/80'
                    : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] cursor-not-allowed'
                }`}
              >
                Add {form.type === 'ai' ? 'Agent' : 'Contact'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
