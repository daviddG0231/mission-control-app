import { NextRequest, NextResponse } from 'next/server'

interface TeamMessage {
  id: string
  channel: string
  sender: string
  message: string
  timestamp: string
  type: 'progress' | 'question' | 'decision' | 'update'
}

interface TeamChannel {
  id: string
  name: string
  description: string
  members: string[]
  unread: number
  active: boolean
}

// In-memory storage for demo (in production, use database)
let messages: TeamMessage[] = [
  {
    id: '1',
    channel: 'ceo',
    sender: 'Dave',
    message: 'Bartera v2 authentication fixed. All tests passing. Ready for production deployment.',
    timestamp: new Date().toISOString(),
    type: 'update'
  },
  {
    id: '2',
    channel: 'ceo', 
    sender: 'Patrick',
    message: '@David - Dave completed auth fixes. Snoopy verified via browser testing. Deploy to production?',
    timestamp: new Date().toISOString(),
    type: 'decision'
  }
]

const channels: TeamChannel[] = [
  {
    id: 'ceo',
    name: 'CEO Channel',
    description: 'David + Patrick + Team Leaders',
    members: ['David', 'Patrick', 'Dave', 'Bob', 'Emma'],
    unread: 2,
    active: true
  },
  {
    id: 'engineering',
    name: 'Engineering Team',
    description: 'Dave + Workers + Patrick',
    members: ['Patrick', 'Dave', 'Mark', 'Mickey', 'Tommy', 'Elliot'],
    unread: 5,
    active: true
  },
  {
    id: 'product',
    name: 'Product Team',
    description: 'Bob + Workers + Patrick',
    members: ['Patrick', 'Bob', 'Stuart', 'Snoopy', 'Bobby'],
    unread: 1,
    active: true
  },
  {
    id: 'business',
    name: 'Business Team',
    description: 'Emma + Workers + Patrick',
    members: ['Patrick', 'Emma', 'Rex', 'Nova', 'Garfield'],
    unread: 0,
    active: true
  }
]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const channel = searchParams.get('channel')
  
  try {
    if (channel) {
      // Get messages for specific channel
      const channelMessages = messages.filter(m => m.channel === channel)
      return NextResponse.json({ messages: channelMessages })
    } else {
      // Get all channels
      return NextResponse.json({ channels, messageCount: messages.length })
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { channel, sender, message, type = 'update' } = body
    
    if (!channel || !sender || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    const newMessage: TeamMessage = {
      id: Date.now().toString(),
      channel,
      sender,
      message,
      timestamp: new Date().toISOString(),
      type
    }
    
    messages.push(newMessage)
    
    return NextResponse.json({ success: true, message: newMessage })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const messageId = searchParams.get('id')
  
  try {
    if (messageId) {
      messages = messages.filter(m => m.id !== messageId)
      return NextResponse.json({ success: true })
    } else {
      // Clear all messages
      messages = []
      return NextResponse.json({ success: true, cleared: true })
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 })
  }
}