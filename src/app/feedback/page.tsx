'use client'

import { useEffect, useState } from 'react'
import { MessageCircle, Send, Bug, Lightbulb, Wrench, Heart, Trash2, Calendar } from 'lucide-react'

interface FeedbackItem {
  id: string
  text: string
  category: 'bug' | 'feature' | 'improvement' | 'praise'
  timestamp: number
  date: string
}

interface FeedbackStats {
  total: number
  byCategory: {
    bug: number
    feature: number
    improvement: number
    praise: number
  }
}

interface FeedbackData {
  success: boolean
  feedback: FeedbackItem[]
  stats: FeedbackStats
}

const CATEGORY_CONFIG = {
  bug: {
    label: 'Bug Report',
    icon: Bug,
    color: 'danger',
    description: 'Report issues or problems'
  },
  feature: {
    label: 'Feature Request',
    icon: Lightbulb,
    color: 'accent',
    description: 'Suggest new features'
  },
  improvement: {
    label: 'Improvement',
    icon: Wrench,
    color: 'warning',
    description: 'Suggest enhancements'
  },
  praise: {
    label: 'Praise',
    icon: Heart,
    color: 'success',
    description: 'Share positive feedback'
  }
}

export default function FeedbackPage() {
  const [feedbackData, setFeedbackData] = useState<FeedbackData>({
    success: false,
    feedback: [],
    stats: {
      total: 0,
      byCategory: { bug: 0, feature: 0, improvement: 0, praise: 0 }
    }
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    text: '',
    category: 'feature' as keyof typeof CATEGORY_CONFIG
  })

  const fetchFeedbackData = async () => {
    try {
      const response = await fetch('/api/feedback')
      if (response.ok) {
        const data = await response.json()
        setFeedbackData(data)
      } else {
        throw new Error('Failed to fetch feedback data')
      }
    } catch (error) {
      console.error('Failed to fetch feedback data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFeedbackData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.text.trim()) return

    setSubmitting(true)
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        setFormData({ text: '', category: 'feature' })
        await fetchFeedbackData() // Refresh data
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to submit feedback')
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error)
      alert('Failed to submit feedback')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this feedback?')) return

    try {
      const response = await fetch(`/api/feedback?id=${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchFeedbackData() // Refresh data
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete feedback')
      }
    } catch (error) {
      console.error('Failed to delete feedback:', error)
      alert('Failed to delete feedback')
    }
  }

  const getCategoryColorClass = (color: string) => ({
    danger: 'text-[var(--danger)]',
    accent: 'text-[var(--accent)]',
    warning: 'text-[var(--warning)]',
    success: 'text-[var(--success)]'
  }[color] || 'text-[var(--text-secondary)]')

  const getCategoryBgClass = (color: string) => ({
    danger: 'bg-[var(--danger)]/20',
    accent: 'bg-[var(--accent)]/20',
    warning: 'bg-[var(--warning)]/20',
    success: 'bg-[var(--success)]/20'
  }[color] || 'bg-[var(--text-secondary)]/20')

  const StatCard = ({ category, count }: { category: keyof typeof CATEGORY_CONFIG; count: number }) => {
    const config = CATEGORY_CONFIG[category]
    const Icon = config.icon
    
    return (
      <div className="bg-[var(--bg-card)] rounded-lg p-4 border border-[var(--border)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-[var(--text-primary)]">{count}</div>
            <div className="text-sm text-[var(--text-secondary)]">{config.label}</div>
          </div>
          <Icon className={`w-6 h-6 ${getCategoryColorClass(config.color)}`} />
        </div>
      </div>
    )
  }

  const FeedbackCard = ({ feedback }: { feedback: FeedbackItem }) => {
    const config = CATEGORY_CONFIG[feedback.category]
    const Icon = config.icon

    return (
      <div className="bg-[var(--bg-card)] rounded-lg p-4 border border-[var(--border)] space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`
              p-2 rounded-lg ${getCategoryBgClass(config.color)}
            `}>
              <Icon className={`w-4 h-4 ${getCategoryColorClass(config.color)}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${getCategoryColorClass(config.color)}`}>
                  {config.label}
                </span>
                <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                  <Calendar className="w-3 h-3" />
                  {new Date(feedback.timestamp).toLocaleDateString()}
                  {' '}
                  {new Date(feedback.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={() => handleDelete(feedback.id)}
            className="p-1 hover:bg-[var(--bg-hover)] rounded text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors"
            title="Delete feedback"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        
        <div className="pl-12">
          <p className="text-[var(--text-primary)] leading-relaxed">{feedback.text}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <MessageCircle className="w-6 h-6 text-[var(--accent)]" />
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Feedback</h1>
      </div>

      {loading && (
        <div className="text-center text-[var(--text-secondary)]">Loading feedback...</div>
      )}

      {/* Stats Overview */}
      {!loading && feedbackData.success && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard category="bug" count={feedbackData.stats.byCategory.bug} />
          <StatCard category="feature" count={feedbackData.stats.byCategory.feature} />
          <StatCard category="improvement" count={feedbackData.stats.byCategory.improvement} />
          <StatCard category="praise" count={feedbackData.stats.byCategory.praise} />
        </div>
      )}

      {/* Submit Feedback Form */}
      <div className="bg-[var(--bg-card)] rounded-lg p-6 border border-[var(--border)]">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Submit Feedback</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--text-primary)]">Category</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                const Icon = config.icon
                const isSelected = formData.category === key
                
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, category: key as keyof typeof CATEGORY_CONFIG }))}
                    className={`
                      p-3 rounded-lg border transition-all text-left
                      ${isSelected 
                        ? `border-[var(--${config.color})] ${getCategoryBgClass(config.color)}` 
                        : 'border-[var(--border)] hover:border-[var(--text-secondary)]'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${isSelected ? getCategoryColorClass(config.color) : 'text-[var(--text-secondary)]'}`} />
                      <span className={`text-sm font-medium ${isSelected ? getCategoryColorClass(config.color) : 'text-[var(--text-secondary)]'}`}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">{config.description}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Text Input */}
          <div className="space-y-2">
            <label htmlFor="feedback-text" className="text-sm font-medium text-[var(--text-primary)]">
              Your Feedback
            </label>
            <textarea
              id="feedback-text"
              value={formData.text}
              onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))}
              placeholder={`Share your ${CATEGORY_CONFIG[formData.category].description.toLowerCase()}...`}
              className="w-full h-32 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] resize-none"
              required
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || !formData.text.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </form>
      </div>

      {/* Feedback List */}
      {!loading && feedbackData.success && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Recent Feedback</h2>
            {feedbackData.stats.total > 0 && (
              <span className="text-sm text-[var(--text-secondary)]">
                {feedbackData.stats.total} total feedback items
              </span>
            )}
          </div>

          {feedbackData.feedback.length === 0 ? (
            <div className="bg-[var(--bg-card)] rounded-lg p-8 border border-[var(--border)] text-center">
              <MessageCircle className="w-12 h-12 text-[var(--text-secondary)] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No Feedback Yet</h3>
              <p className="text-[var(--text-secondary)]">Be the first to share your thoughts!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {feedbackData.feedback.map((feedback) => (
                <FeedbackCard key={feedback.id} feedback={feedback} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}