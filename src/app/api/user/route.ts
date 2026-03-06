import { NextResponse } from 'next/server'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'user'
}

export async function GET() {
  const name = process.env.USER_NAME || 'User'
  const id = process.env.USER_ID || slugify(name)
  return NextResponse.json({
    id,
    name,
    role: 'Human Lead',
    avatar: process.env.USER_AVATAR || '👨‍💻',
  })
}
