'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, ArrowLeft, RefreshCw, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Agent {
  id: string
  name: string
  emoji: string
  role?: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export default function ChatPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [typing, setTyping] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevMsgCountRef = useRef(0)

  // Load agents
  useEffect(() => {
    fetch('/api/chat')
      .then(r => r.json())
      .then(d => { setAgents(d.agents || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Load chat history
  const loadHistory = useCallback(async (agentId: string, silent = false) => {
    if (!silent) setLoadingHistory(true)
    try {
      const res = await fetch(`/api/chat?agentId=${agentId}`)
      const data = await res.json()
      const newMsgs: ChatMessage[] = data.messages || []
      
      setMessages(newMsgs)
      
      // If we got a new assistant message, stop typing indicator
      if (newMsgs.length > prevMsgCountRef.current) {
        const lastMsg = newMsgs[newMsgs.length - 1]
        if (lastMsg?.role === 'assistant') {
          setTyping(false)
          stopPolling()
        }
      }
      prevMsgCountRef.current = newMsgs.length
      
      // If agent is generating, show typing
      if (data.isGenerating) {
        setTyping(true)
      }
    } catch { /* ignore */ }
    if (!silent) setLoadingHistory(false)
  }, [])

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const startPolling = useCallback((agentId: string) => {
    stopPolling()
    pollingRef.current = setInterval(() => {
      loadHistory(agentId, true)
    }, 3000)
    // Auto-stop after 2 minutes
    setTimeout(() => stopPolling(), 120000)
  }, [loadHistory, stopPolling])

  useEffect(() => {
    if (selectedAgent) {
      loadHistory(selectedAgent.id)
    }
    return () => stopPolling()
  }, [selectedAgent, loadHistory, stopPolling])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  // Send message
  const sendMessage = async () => {
    if (!input.trim() || !selectedAgent || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    setTyping(true)

    // Optimistic add
    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() }
    setMessages(prev => [...prev, userMsg])
    prevMsgCountRef.current += 1

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: selectedAgent.id, message: text }),
      })
      const data = await res.json()
      if (!data.ok) {
        setTyping(false)
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${data.error}`, timestamp: Date.now() }])
      } else {
        // Start polling for the response
        startPolling(selectedAgent.id)
      }
    } catch {
      setTyping(false)
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Failed to send message', timestamp: Date.now() }])
    }
    setSending(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Agent list view
  if (!selectedAgent) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-[var(--accent)]" />
            Chat with Team
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Select an agent to start a conversation
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <RefreshCw className="w-6 h-6 text-[var(--accent)] animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {agents.filter(a => a.id !== 'builder').map(agent => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className="flex items-center gap-4 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)]/40 hover:bg-[var(--bg-hover)] transition-all text-left group"
              >
                <div className="text-3xl group-hover:scale-110 transition-transform">
                  {agent.emoji}
                </div>
                <div>
                  <div className="font-bold text-white text-sm">{agent.name}</div>
                  <div className="text-xs text-[var(--text-secondary)]">{agent.role || agent.id}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Chat view
  return (
    <div className="flex flex-col h-[calc(100vh-var(--header-height,48px))]">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-card)]">
        <button
          onClick={() => { setSelectedAgent(null); setMessages([]); stopPolling(); setTyping(false) }}
          className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
        <div className="text-2xl">{selectedAgent.emoji}</div>
        <div className="flex-1">
          <div className="font-bold text-white text-sm">{selectedAgent.name}</div>
          <div className="text-xs text-[var(--text-secondary)]">
            {typing ? (
              <span className="text-[var(--accent)] flex items-center gap-1">
                typing
                <span className="inline-flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </span>
            ) : (
              selectedAgent.role || selectedAgent.id
            )}
          </div>
        </div>
        <button
          onClick={() => loadHistory(selectedAgent.id)}
          className="p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4 text-[var(--text-secondary)]', loadingHistory && 'animate-spin')} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loadingHistory ? (
          <div className="flex justify-center py-20">
            <RefreshCw className="w-5 h-5 text-[var(--accent)] animate-spin" />
          </div>
        ) : messages.length === 0 && !typing ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">{selectedAgent.emoji}</div>
            <div className="text-[var(--text-secondary)] text-sm">
              Send a message to start chatting with {selectedAgent.name}
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-2 opacity-60">
              This will spawn {selectedAgent.name} as a sub-agent to respond
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-[var(--accent)] text-black rounded-br-md'
                    : 'bg-[var(--bg-card)] border border-[var(--border)] text-white rounded-bl-md',
                )}>
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                </div>
              </div>
            ))}
            {/* Typing indicator bubble */}
            {typing && (
              <div className="flex justify-start">
                <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[var(--text-secondary)] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-[var(--text-secondary)] animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-[var(--text-secondary)] animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-card)]">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${selectedAgent.name}...`}
            rows={1}
            className="flex-1 bg-[var(--bg-main)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[var(--text-secondary)] resize-none focus:outline-none focus:border-[var(--accent)]/50 max-h-32"
            style={{ minHeight: '42px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className={cn(
              'p-2.5 rounded-xl transition-all',
              input.trim() && !sending
                ? 'bg-[var(--accent)] text-black hover:opacity-90'
                : 'bg-[var(--bg-hover)] text-[var(--text-secondary)]',
            )}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
