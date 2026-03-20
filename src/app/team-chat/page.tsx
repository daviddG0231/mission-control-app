'use client'

import { useState, useEffect } from 'react'
import { MessageSquare, Users, Send, Circle } from 'lucide-react'

interface TeamMessage {
  id: string
  channel: string
  sender: string
  message: string
  timestamp: Date
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

export default function TeamChatPage() {
  const [activeChannel, setActiveChannel] = useState('ceo')
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<TeamMessage[]>([])
  
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
    },
    {
      id: 'all-hands',
      name: 'All Hands',
      description: 'Everyone - Major updates',
      members: ['David', 'Patrick', 'Dave', 'Bob', 'Emma', 'All Workers'],
      unread: 0,
      active: false
    }
  ]

  const sampleMessages: TeamMessage[] = [
    {
      id: '1',
      channel: 'ceo',
      sender: 'Dave',
      message: 'Bartera v2 authentication fixed. All tests passing. Ready for production deployment.',
      timestamp: new Date('2026-03-16T17:30:00'),
      type: 'update'
    },
    {
      id: '2',
      channel: 'ceo',
      sender: 'Patrick',
      message: '@David - Dave completed auth fixes. Snoopy verified via browser testing. Deploy to production?',
      timestamp: new Date('2026-03-16T17:32:00'),
      type: 'decision'
    },
    {
      id: '3',
      channel: 'engineering',
      sender: 'Mark',
      message: 'Database migration for user preferences completed. Zero downtime achieved.',
      timestamp: new Date('2026-03-16T17:25:00'),
      type: 'progress'
    },
    {
      id: '4',
      channel: 'engineering',
      sender: 'Mickey',
      message: 'Image upload UI updated with Cloudinary integration. Previews working correctly.',
      timestamp: new Date('2026-03-16T17:28:00'),
      type: 'progress'
    },
    {
      id: '5',
      channel: 'product',
      sender: 'Snoopy',
      message: 'QA testing complete for Bartera v2. Found 0 critical issues, 2 minor UX improvements needed.',
      timestamp: new Date('2026-03-16T17:35:00'),
      type: 'update'
    }
  ]

  useEffect(() => {
    setMessages(sampleMessages.filter(m => m.channel === activeChannel))
  }, [activeChannel])

  const sendMessage = () => {
    if (message.trim()) {
      const newMessage: TeamMessage = {
        id: Date.now().toString(),
        channel: activeChannel,
        sender: 'David',
        message: message.trim(),
        timestamp: new Date(),
        type: 'update'
      }
      setMessages([...messages, newMessage])
      setMessage('')
    }
  }

  const getStatusColor = (type: string) => {
    switch (type) {
      case 'progress': return 'text-blue-600'
      case 'question': return 'text-yellow-600'
      case 'decision': return 'text-purple-600'
      case 'update': return 'text-green-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="h-screen flex">
      {/* Sidebar - Channel List */}
      <div className="w-80 bg-gray-50 border-r flex flex-col">
        <div className="p-4 border-b bg-white">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Communication
          </h1>
          <p className="text-sm text-gray-600 mt-1">Autonomous team collaboration</p>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {channels.map((channel) => (
            <div
              key={channel.id}
              onClick={() => setActiveChannel(channel.id)}
              className={`p-4 border-b cursor-pointer hover:bg-white transition-colors ${
                activeChannel === channel.id ? 'bg-white border-l-4 border-l-blue-500' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Circle className={`w-3 h-3 ${channel.active ? 'text-green-500 fill-current' : 'text-gray-400'}`} />
                  <h3 className="font-medium text-gray-900">{channel.name}</h3>
                  {channel.unread > 0 && (
                    <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {channel.unread}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-1">{channel.description}</p>
              <p className="text-xs text-gray-500 mt-1">{channel.members.length} members</p>
            </div>
          ))}
        </div>
        
        <div className="p-4 bg-gray-100 border-t">
          <div className="text-sm text-gray-600">
            <p><strong>Active Teams:</strong> {channels.filter(c => c.active).length}</p>
            <p><strong>Total Messages:</strong> {sampleMessages.length}</p>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="p-4 border-b bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {channels.find(c => c.id === activeChannel)?.name}
              </h2>
              <p className="text-sm text-gray-600">
                {channels.find(c => c.id === activeChannel)?.description}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Circle className="w-3 h-3 text-green-500 fill-current" />
              <span className="text-sm text-gray-600">
                {channels.find(c => c.id === activeChannel)?.members.length} active
              </span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-blue-600">
                  {msg.sender[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">{msg.sender}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full bg-gray-100 ${getStatusColor(msg.type)}`}>
                    {msg.type}
                  </span>
                  <span className="text-xs text-gray-500">
                    {msg.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-gray-700">{msg.message}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Message Input */}
        <div className="p-4 border-t bg-white">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={`Message ${channels.find(c => c.id === activeChannel)?.name}...`}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={sendMessage}
              disabled={!message.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}