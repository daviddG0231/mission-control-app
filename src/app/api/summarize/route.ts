import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ summary: '' })
    }

    // Truncate to first 1000 chars to keep it fast
    const truncated = text.slice(0, 1000)

    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemma3:1b',
        prompt: `Summarize the following in exactly ONE short sentence (max 15 words). Just the summary, nothing else:\n\n${truncated}`,
        stream: false,
        options: { temperature: 0.1, num_predict: 50 }
      })
    })

    if (!res.ok) {
      return NextResponse.json({ summary: '' })
    }

    const data = await res.json()
    const summary = (data.response || '').trim().replace(/^["']|["']$/g, '')

    return NextResponse.json({ summary })
  } catch {
    return NextResponse.json({ summary: '' })
  }
}
