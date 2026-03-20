import { NextRequest, NextResponse } from 'next/server'
import { TeamSpawner } from '@/lib/agent-spawner'

interface TeamSpawnRequest {
  projectName: string
  description: string
  teamLeader: 'dave' | 'bob' | 'bolt'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  davidInLoop: boolean
}

// Map team leaders to their channels and workers
const teamStructure = {
  dave: {
    channel: 'engineering',
    workers: ['mark', 'mickey', 'tommy', 'elliot'],
    role: 'CTO & Engineering Lead'
  },
  bob: {
    channel: 'product',
    workers: ['stuart', 'snoopy', 'bobby'],
    role: 'CDO & Product Lead'
  },
  bolt: {
    channel: 'business',
    workers: ['rex', 'nova', 'garfield'],
    role: 'CBO & Business Lead'
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: TeamSpawnRequest = await request.json()
    const { projectName, description, teamLeader, priority, davidInLoop } = body
    
    const team = teamStructure[teamLeader]
    if (!team) {
      return NextResponse.json({ error: 'Invalid team leader' }, { status: 400 })
    }

    // Initialize the team spawner
    const spawner = new TeamSpawner()
    
    // Spawn the actual autonomous team with real agents
    const result = await spawner.spawnAutonomousTeam({
      projectName,
      description,
      teamLeader,
      priority,
      davidInLoop
    })
    
    return NextResponse.json({
      success: true,
      ...result,
      nextSteps: [
        '✅ Team leader and workers spawned as real agents',
        '✅ Team chat communication established',
        '✅ Cross-team collaboration enabled',
        '🔔 David will receive real-time progress updates',
        '📊 Watch team chat for live agent communication'
      ],
      realAgents: true,
      sessionIds: result.teamConfig?.sessionIds || []
    })

  } catch (error) {
    console.error('Team spawn error:', error)
    return NextResponse.json({ error: 'Failed to spawn team' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    availableTeams: teamStructure,
    spawnOptions: {
      priorities: ['low', 'medium', 'high', 'urgent'],
      channels: ['engineering', 'product', 'business'],
      features: [
        'Real-time team communication',
        'Cross-team collaboration',
        'David notification system',
        'Autonomous task delegation',
        'Progress reporting',
        'Blocker escalation'
      ]
    }
  })
}