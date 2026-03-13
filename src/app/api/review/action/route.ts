import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import path from 'path'

const WORKSPACE = path.join(process.env.HOME || '/Users/david', '.openclaw/workspace')
const DATA_DIR = path.join(WORKSPACE, 'mission-control-app/data')
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json')

function getReviews(): Record<string, string> {
  try {
    if (existsSync(REVIEWS_FILE)) {
      return JSON.parse(readFileSync(REVIEWS_FILE, 'utf-8'))
    }
  } catch {}
  return {}
}

function saveReviews(reviews: Record<string, string>) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { changeId, action, filePath, oldString, newString } = body

    if (!changeId || !action) {
      return NextResponse.json({ error: 'Missing changeId or action' }, { status: 400 })
    }

    if (action === 'accept') {
      // Mark as accepted — the change stays as-is
      const reviews = getReviews()
      reviews[changeId] = 'accepted'
      saveReviews(reviews)
      return NextResponse.json({ success: true, message: 'Change accepted' })
    }

    if (action === 'reject') {
      // Revert the change
      if (!filePath) {
        return NextResponse.json({ error: 'Missing filePath for reject' }, { status: 400 })
      }

      // Security check
      const resolved = path.resolve(filePath)
      if (!resolved.startsWith(WORKSPACE)) {
        return NextResponse.json({ error: 'Path outside workspace' }, { status: 403 })
      }

      if (!existsSync(filePath)) {
        // File was created by write and then deleted — just mark as rejected
        const reviews = getReviews()
        reviews[changeId] = 'rejected'
        saveReviews(reviews)
        return NextResponse.json({ success: true, message: 'Change rejected (file already gone)' })
      }

      // For edit: replace newString back with oldString
      if (oldString && newString) {
        const currentContent = readFileSync(filePath, 'utf-8')
        if (currentContent.includes(newString)) {
          const reverted = currentContent.replace(newString, oldString)
          writeFileSync(filePath, reverted)
          const reviews = getReviews()
          reviews[changeId] = 'rejected'
          saveReviews(reviews)
          return NextResponse.json({ success: true, message: 'Edit reverted' })
        } else {
          // The new text isn't in the file anymore (maybe overwritten by another edit)
          const reviews = getReviews()
          reviews[changeId] = 'rejected'
          saveReviews(reviews)
          return NextResponse.json({ 
            success: true, 
            message: 'Marked as rejected (file was modified since this change — manual review may be needed)',
            warning: true
          })
        }
      }

      // For write: we can't easily revert a full file write without knowing original content
      // Mark as rejected and let user know
      const reviews = getReviews()
      reviews[changeId] = 'rejected'
      saveReviews(reviews)
      return NextResponse.json({ 
        success: true, 
        message: 'Marked as rejected. For full file writes, use git to revert if needed.',
        warning: true
      })
    }

    if (action === 'accept-all' || action === 'reject-all') {
      const { changeIds } = body
      if (!Array.isArray(changeIds)) {
        return NextResponse.json({ error: 'Missing changeIds array' }, { status: 400 })
      }
      const reviews = getReviews()
      const status = action === 'accept-all' ? 'accepted' : 'rejected'
      for (const id of changeIds) {
        reviews[id] = status
      }
      saveReviews(reviews)
      return NextResponse.json({ success: true, message: `${changeIds.length} changes ${status}` })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
