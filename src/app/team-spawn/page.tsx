'use client'

import { useState } from 'react'
import { Users, Zap, MessageSquare, ArrowRight, CheckCircle, Clock } from 'lucide-react'

interface SpawnResult {
  success: boolean
  spawnConfig: any
  messages: {
    ceoChannel: any
    teamChannel: any
  }
  nextSteps: string[]
}

export default function TeamSpawnPage() {
  const [projectName, setProjectName] = useState('')
  const [description, setDescription] = useState('')
  const [teamLeader, setTeamLeader] = useState<'dave' | 'bob' | 'bolt'>('dave')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium')
  const [davidInLoop, setDavidInLoop] = useState(true)
  const [spawning, setSpawning] = useState(false)
  const [result, setResult] = useState<SpawnResult | null>(null)

  const teams = {
    dave: {
      name: 'Engineering Team',
      role: 'CTO & Engineering Lead',
      workers: ['Mark ⚙️', 'Mickey 🎨', 'Tommy 📱', 'Elliot 🖥️'],
      channel: 'engineering',
      color: 'bg-blue-500'
    },
    bob: {
      name: 'Product Team',
      role: 'CDO & Product Lead',
      workers: ['Stuart 🎯', 'Snoopy 🔍', 'Bobby 🔬'],
      channel: 'product',
      color: 'bg-purple-500'
    },
    bolt: {
      name: 'Business Team',
      role: 'CBO & Business Lead',
      workers: ['Rex 💼', 'Nova 📈', 'Garfield 🐱'],
      channel: 'business',
      color: 'bg-green-500'
    }
  }

  const spawnTeam = async () => {
    if (!projectName || !description) return

    setSpawning(true)
    
    try {
      const response = await fetch('/api/team-spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName,
          description,
          teamLeader,
          priority,
          davidInLoop
        })
      })

      const data = await response.json()
      setResult(data)

      // Simulate sending messages to team chat
      if (data.success) {
        // Send CEO channel message
        await fetch('/api/team-chat', {
          method: 'POST',
          body: JSON.stringify(data.messages.ceoChannel)
        })
        
        // Send team channel message  
        await fetch('/api/team-chat', {
          method: 'POST', 
          body: JSON.stringify(data.messages.teamChannel)
        })
      }

    } catch (error) {
      console.error('Spawn failed:', error)
    } finally {
      setSpawning(false)
    }
  }

  if (result?.success) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <h1 className="text-xl font-bold text-green-800">Team Successfully Spawned!</h1>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Project Details</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Name:</strong> {projectName}</p>
                <p><strong>Team Leader:</strong> {teams[teamLeader].role}</p>
                <p><strong>Priority:</strong> {priority.toUpperCase()}</p>
                <p><strong>David in Loop:</strong> {davidInLoop ? '✅ YES' : '❌ NO'}</p>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Team Activated</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Channel:</strong> #{teams[teamLeader].channel}</p>
                <p><strong>Workers:</strong> {teams[teamLeader].workers.length}</p>
                <p><strong>Communication:</strong> Real-time</p>
                <p><strong>Status:</strong> 🟢 Active</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-blue-600" />
            Next Steps
          </h2>
          <ol className="space-y-2">
            {result.nextSteps.map((step, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                  {index + 1}
                </span>
                <span className="text-gray-700">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex gap-4">
          <a
            href="/team-chat"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            View Team Chat
          </a>
          
          <button
            onClick={() => setResult(null)}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Spawn Another Team
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Users className="w-6 h-6 text-blue-600" />
          Autonomous Team Spawner
        </h1>
        <p className="text-gray-600 mt-2">
          Launch autonomous agent teams with real-time communication and David in the feedback loop
        </p>
      </div>

      <div className="bg-white border rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-6">Project Configuration</h2>
        
        <div className="space-y-6">
          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project Name *
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., Bartera v3 Development"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project Description *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what the team should accomplish..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Team Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Team Leader & Team *
            </label>
            <div className="grid md:grid-cols-3 gap-4">
              {Object.entries(teams).map(([id, team]) => (
                <div
                  key={id}
                  onClick={() => setTeamLeader(id as any)}
                  className={`border rounded-lg p-4 cursor-pointer transition ${
                    teamLeader === id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-3 h-3 rounded-full ${team.color}`} />
                    <h3 className="font-medium text-gray-900">{team.name}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{team.role}</p>
                  <div className="text-xs text-gray-500">
                    <p>Channel: #{team.channel}</p>
                    <p>Workers: {team.workers.join(', ')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority Level
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="low">Low - Standard timeline</option>
              <option value="medium">Medium - Moderate urgency</option>
              <option value="high">High - Important & urgent</option>
              <option value="urgent">Urgent - Drop everything</option>
            </select>
          </div>

          {/* David in Loop */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={davidInLoop}
                onChange={(e) => setDavidInLoop(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              Keep David in the feedback loop
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Real-time progress notifications and decision requests sent to David
            </p>
          </div>
        </div>
      </div>

      {/* Spawn Button */}
      <button
        onClick={spawnTeam}
        disabled={!projectName || !description || spawning}
        className="w-full py-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {spawning ? (
          <>
            <Clock className="w-4 h-4 animate-spin" />
            Spawning Team...
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            Spawn Autonomous Team
          </>
        )}
      </button>
    </div>
  )
}