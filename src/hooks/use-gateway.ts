'use client'

import { useState, useEffect, useCallback } from 'react'

// In-memory cache: endpoint -> { data, fetchedAt }
const cache = new Map<string, { data: unknown; fetchedAt: number }>()
const CACHE_TTL_MS = 30_000 // Use cached data for 30s before considering stale

function getCached<T>(endpoint: string): T | null {
  const entry = cache.get(endpoint)
  if (!entry) return null
  return entry.data as T
}

function setCached(endpoint: string, data: unknown) {
  cache.set(endpoint, { data, fetchedAt: Date.now() })
}

export function useGatewayData<T>(endpoint: string, refreshInterval = 10000) {
  const cached = getCached<T>(endpoint)
  const [data, setData] = useState<T | null>(cached)
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(endpoint, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setCached(endpoint, json)
      setData(json)
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch')
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  useEffect(() => {
    const entry = cache.get(endpoint)
    const stale = !entry || Date.now() - entry.fetchedAt > CACHE_TTL_MS
    if (stale) {
      fetchData()
    }
    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [endpoint, fetchData, refreshInterval])

  return { data, loading, error, refetch: fetchData }
}

/** Clear the cache (e.g. after config change). */
export function clearGatewayCache(endpoint?: string) {
  if (endpoint) cache.delete(endpoint)
  else cache.clear()
}
