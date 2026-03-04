/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface FeedbackItem {
  id: string
  text: string
  category: 'bug' | 'feature' | 'improvement' | 'praise'
  timestamp: number
  date: string
}

interface FeedbackData {
  feedback: FeedbackItem[]
  stats: {
    total: number
    byCategory: {
      bug: number
      feature: number
      improvement: number
      praise: number
    }
  }
}

const FEEDBACK_FILE = path.join(process.cwd(), 'data', 'feedback.json')

function ensureDataDirectory() {
  const dataDir = path.dirname(FEEDBACK_FILE)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
}

function readFeedbackData(): FeedbackData {
  ensureDataDirectory()
  
  if (!fs.existsSync(FEEDBACK_FILE)) {
    return {
      feedback: [],
      stats: {
        total: 0,
        byCategory: {
          bug: 0,
          feature: 0,
          improvement: 0,
          praise: 0
        }
      }
    }
  }

  try {
    const data = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf-8'))
    
    // Calculate stats
    const feedback = data.feedback || []
    const stats = {
      total: feedback.length,
      byCategory: {
        bug: feedback.filter((item: FeedbackItem) => item.category === 'bug').length,
        feature: feedback.filter((item: FeedbackItem) => item.category === 'feature').length,
        improvement: feedback.filter((item: FeedbackItem) => item.category === 'improvement').length,
        praise: feedback.filter((item: FeedbackItem) => item.category === 'praise').length
      }
    }
    
    return { feedback, stats }
  } catch (error) {
    console.error('Error reading feedback data:', error)
    return {
      feedback: [],
      stats: {
        total: 0,
        byCategory: {
          bug: 0,
          feature: 0,
          improvement: 0,
          praise: 0
        }
      }
    }
  }
}

function writeFeedbackData(data: FeedbackData) {
  ensureDataDirectory()
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

export async function GET() {
  try {
    const data = readFeedbackData()
    return NextResponse.json({
      success: true,
      ...data
    })
  } catch (error) {
    console.error('Error in feedback GET:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch feedback data',
        feedback: [],
        stats: {
          total: 0,
          byCategory: { bug: 0, feature: 0, improvement: 0, praise: 0 }
        }
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, category } = body

    // Validation
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Text is required' },
        { status: 400 }
      )
    }

    if (!category || !['bug', 'feature', 'improvement', 'praise'].includes(category)) {
      return NextResponse.json(
        { success: false, error: 'Valid category is required' },
        { status: 400 }
      )
    }

    // Read current data
    const data = readFeedbackData()

    // Create new feedback item
    const now = Date.now()
    const newFeedback: FeedbackItem = {
      id: `feedback_${now}_${Math.random().toString(36).substr(2, 9)}`,
      text: text.trim(),
      category,
      timestamp: now,
      date: new Date(now).toISOString()
    }

    // Add to feedback list (newest first)
    data.feedback.unshift(newFeedback)

    // Update stats
    data.stats.total = data.feedback.length
    data.stats.byCategory[category as keyof typeof data.stats.byCategory]++

    // Write back to file
    writeFeedbackData(data)

    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully',
      feedback: newFeedback
    })
  } catch (error) {
    console.error('Error in feedback POST:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to submit feedback' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Feedback ID is required' },
        { status: 400 }
      )
    }

    const data = readFeedbackData()
    const initialLength = data.feedback.length
    
    // Remove feedback item
    data.feedback = data.feedback.filter(item => item.id !== id)

    if (data.feedback.length === initialLength) {
      return NextResponse.json(
        { success: false, error: 'Feedback not found' },
        { status: 404 }
      )
    }

    // Recalculate stats
    data.stats = {
      total: data.feedback.length,
      byCategory: {
        bug: data.feedback.filter(item => item.category === 'bug').length,
        feature: data.feedback.filter(item => item.category === 'feature').length,
        improvement: data.feedback.filter(item => item.category === 'improvement').length,
        praise: data.feedback.filter(item => item.category === 'praise').length
      }
    }

    writeFeedbackData(data)

    return NextResponse.json({
      success: true,
      message: 'Feedback deleted successfully'
    })
  } catch (error) {
    console.error('Error in feedback DELETE:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete feedback' },
      { status: 500 }
    )
  }
}