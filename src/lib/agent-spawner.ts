// Real agent spawning with team chat integration

interface TeamSpawnConfig {
  projectName: string
  description: string
  teamLeader: 'dave' | 'bob' | 'bolt'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  davidInLoop: boolean
}

interface AgentConfig {
  agentId: string
  name: string
  role: string
  channel: string
  reportingEnabled: boolean
}

const agentConfigs: Record<string, AgentConfig> = {
  // Team Leaders
  dave: { agentId: 'dave', name: 'Dave', role: 'CTO & Engineering Lead', channel: 'engineering', reportingEnabled: true },
  bob: { agentId: 'bob', name: 'Bob', role: 'CDO & Product Lead', channel: 'product', reportingEnabled: true },
  bolt: { agentId: 'bolt', name: 'Emma', role: 'CBO & Business Lead', channel: 'business', reportingEnabled: true },
  
  // Engineering Workers
  mark: { agentId: 'mark', name: 'Mark', role: 'Backend Developer', channel: 'engineering', reportingEnabled: true },
  mickey: { agentId: 'mickey', name: 'Mickey', role: 'Frontend Developer', channel: 'engineering', reportingEnabled: true },
  tommy: { agentId: 'tommy', name: 'Tommy', role: 'Mobile Developer', channel: 'engineering', reportingEnabled: true },
  elliot: { agentId: 'elliot', name: 'Elliot', role: 'DevOps Engineer', channel: 'engineering', reportingEnabled: true },
  
  // Product Workers  
  stuart: { agentId: 'stuart', name: 'Stuart', role: 'UI/UX Designer', channel: 'product', reportingEnabled: true },
  snoopy: { agentId: 'snoopy', name: 'Snoopy', role: 'QA & Testing', channel: 'product', reportingEnabled: true },
  bobby: { agentId: 'bobby', name: 'Bobby', role: 'Research Analyst', channel: 'product', reportingEnabled: true },
  
  // Business Workers
  rex: { agentId: 'rex', name: 'Rex', role: 'Business & Freelancing', channel: 'business', reportingEnabled: true },
  nova: { agentId: 'nova', name: 'Nova', role: 'Data Analyst', channel: 'business', reportingEnabled: true },
  garfield: { agentId: 'garfield', name: 'Garfield', role: 'ML/AI Engineer', channel: 'business', reportingEnabled: true }
}

export class TeamSpawner {
  private baseUrl: string
  
  constructor(baseUrl = 'http://localhost:18789') {
    this.baseUrl = baseUrl
  }

  async spawnAutonomousTeam(config: TeamSpawnConfig): Promise<any> {
    try {
      // Step 1: Notify CEO channel that team is being spawned
      await this.sendTeamMessage('ceo', 'Patrick', 
        `🚀 **SPAWNING AUTONOMOUS TEAM**: ${config.projectName}\n\n` +
        `📋 **Project**: ${config.description}\n` +
        `⚡ **Priority**: ${config.priority.toUpperCase()}\n` +
        `👨‍💼 **Team Leader**: ${agentConfigs[config.teamLeader].name} (${agentConfigs[config.teamLeader].role})\n` +
        `🔔 **David in Loop**: ${config.davidInLoop ? '✅ YES' : '❌ NO'}\n\n` +
        `**Spawning team leader and workers now...**`, 
        'update'
      )

      // Step 2: Spawn the team leader with special instructions
      const teamLeaderConfig = agentConfigs[config.teamLeader]
      const leaderSession = await this.spawnAgent({
        agentId: config.teamLeader,
        task: this.createLeaderTask(config),
        teamChannel: teamLeaderConfig.channel,
        priority: config.priority,
        davidInLoop: config.davidInLoop
      })

      // Step 3: Get worker list for this team
      const workerIds = this.getTeamWorkers(config.teamLeader)
      
      // Step 4: Spawn workers with collaborative instructions
      const workerSessions = await Promise.all(
        workerIds.map(workerId => 
          this.spawnAgent({
            agentId: workerId,
            task: this.createWorkerTask(config, workerId),
            teamChannel: teamLeaderConfig.channel,
            priority: config.priority,
            davidInLoop: config.davidInLoop
          })
        )
      )

      // Step 5: Send team activation message
      await this.sendTeamMessage(
        teamLeaderConfig.channel, 
        'Patrick',
        `🎯 **TEAM ACTIVATED**: ${config.projectName}\n\n` +
        `📋 **Mission**: ${config.description}\n` +
        `⚡ **Priority**: ${config.priority.toUpperCase()}\n\n` +
        `**TEAM LEADER** @${teamLeaderConfig.name}: You are in command. Delegate tasks, coordinate work, report progress.\n\n` +
        `**WORKERS**: ${workerIds.map(w => `@${agentConfigs[w].name}`).join(', ')}\n` +
        `- Collaborate directly with each other\n` +
        `- Report blockers immediately\n` +
        `- Ask questions in this channel\n` +
        `- Cross-post to other teams when needed\n\n` +
        `**COMMUNICATION RULES**:\n` +
        `✅ Report progress every 15-30 minutes\n` +
        `✅ Tag @Patrick for major decisions\n` +
        `✅ Tag @David when his input is needed\n` +
        `✅ Ask other teams for help via cross-posting\n\n` +
        `**LET'S BUILD SOMETHING AMAZING! 🚀**`,
        'update'
      )

      // Step 6: Set up cross-team collaboration
      await this.enableCrossTeamCommunication(config, [leaderSession, ...workerSessions])

      return {
        success: true,
        leaderSession,
        workerSessions,
        teamConfig: {
          ...config,
          spawnedAt: new Date().toISOString(),
          sessionIds: [leaderSession.sessionId, ...workerSessions.map(w => w.sessionId)]
        }
      }

    } catch (error) {
      console.error('Team spawn failed:', error)
      
      // Notify of failure
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await this.sendTeamMessage('ceo', 'Patrick',
        `❌ **TEAM SPAWN FAILED**: ${config.projectName}\n\n` +
        `Error: ${errorMessage}\n\n` +
        `Please retry or contact support.`,
        'update'
      )
      
      throw error
    }
  }

  private async spawnAgent(config: {
    agentId: string
    task: string
    teamChannel: string
    priority: string
    davidInLoop: boolean
  }): Promise<any> {
    
    const response = await fetch(`${this.baseUrl}/api/sessions/spawn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runtime: 'subagent',
        agentId: config.agentId,
        mode: 'session',
        task: config.task,
        timeoutSeconds: 3600, // 1 hour
        label: `${agentConfigs[config.agentId].name}-${Date.now()}`,
        thread: true
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to spawn agent ${config.agentId}: ${response.statusText}`)
    }

    const result = await response.json()
    
    // Send spawn confirmation to team channel
    await this.sendTeamMessage(
      config.teamChannel,
      'System',
      `✅ **${agentConfigs[config.agentId].name}** has joined the team (${agentConfigs[config.agentId].role})`,
      'update'
    )

    return result
  }

  private createLeaderTask(config: TeamSpawnConfig): string {
    return `**TEAM LEADER MISSION**: ${config.projectName}

**YOUR ROLE**: You are the ${agentConfigs[config.teamLeader].role} leading this project.

**PROJECT SCOPE**: ${config.description}

**PRIORITY**: ${config.priority.toUpperCase()}

**TEAM COMMUNICATION RULES**:
- Use team chat channel #${agentConfigs[config.teamLeader].channel} for coordination
- Report progress to Patrick every 15-30 minutes
- Tag @David when his input/approval is needed
- Collaborate with other team leaders when needed
- Delegate tasks to your team workers clearly

**YOUR RESPONSIBILITIES**:
1. Break down the project into clear tasks
2. Assign work to your team members
3. Coordinate with other teams (Engineering, Product, Business)
4. Report blockers and progress to Patrick
5. Ensure quality delivery on time

**STRICT QUALITY STANDARDS**:
- Excellence is mandatory
- No rushing work "just to finish"
- Ask clarifying questions before starting
- Test thoroughly before reporting complete
- Take responsibility for team's output

**START NOW**: Begin by analyzing the project, creating a task breakdown, and assigning work to your team. Report your initial plan within 10 minutes.`
  }

  private createWorkerTask(config: TeamSpawnConfig, workerId: string): string {
    const worker = agentConfigs[workerId]
    const leader = agentConfigs[config.teamLeader]
    
    return `**WORKER MISSION**: ${config.projectName}

**YOUR ROLE**: ${worker.role} on ${leader.name}'s team

**PROJECT**: ${config.description}

**PRIORITY**: ${config.priority.toUpperCase()}

**COMMUNICATION & COLLABORATION**:
- Primary channel: #${worker.channel}
- Report to team leader @${leader.name}
- Collaborate with teammates directly
- Ask questions immediately - don't guess
- Cross-post to other teams when you need their expertise

**WORK STANDARDS**:
- Quality over speed - ALWAYS
- No rushing to "just finish" - Patrick will replace you
- Ask clarifying questions before starting work
- Test your work thoroughly
- Report blockers immediately
- Take initiative within your expertise

**AUTONOMOUS BEHAVIOR**:
- Work independently but communicate progress
- Help teammates when they need your skills
- Suggest improvements and optimizations
- Take ownership of your deliverables

**WAIT FOR TASK ASSIGNMENT** from your team leader @${leader.name}. Once assigned, confirm understanding and begin work immediately.`
  }

  private getTeamWorkers(teamLeader: string): string[] {
    const teams: Record<string, string[]> = {
      dave: ['mark', 'mickey', 'tommy', 'elliot'],
      bob: ['stuart', 'snoopy', 'bobby'], 
      bolt: ['rex', 'nova', 'garfield']
    }
    return teams[teamLeader] || []
  }

  private async sendTeamMessage(channel: string, sender: string, message: string, type: string) {
    try {
      await fetch('/api/team-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          sender,
          message,
          type,
          timestamp: new Date().toISOString()
        })
      })
    } catch (error) {
      console.error('Failed to send team message:', error)
    }
  }

  private async enableCrossTeamCommunication(config: TeamSpawnConfig, sessions: any[]) {
    // Set up cross-team messaging capabilities
    // This would integrate with the sessions_send API to allow agents to communicate across teams
    console.log('Cross-team communication enabled for:', sessions.map(s => s.sessionId))
  }
}