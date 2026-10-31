import { useEffect, useState } from 'react'
import type { Category } from './database.types'
import { supabase } from './supabase'

// Categories barely change: show the last known list at once, refresh it in the background
const CACHE_KEY = 'bidigo:categories:v1'

function cached(): Category[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Category[]) : []
  } catch {
    return []
  }
}

let inflight: Promise<Category[] | null> | null = null

function fetchCategories() {
  inflight ??= Promise.resolve(supabase.from('categories').select('*').order('sort_order')).then(({ data }) => {
    inflight = null
    if (!data) return null
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data))
    } catch {
      // storage full / blocked: the list just loads from the network next time
    }
    return data as Category[]
  })
  return inflight
}

export function useCategories(): Category[] {
  const [categories, setCategories] = useState<Category[]>(cached)
  useEffect(() => {
    let live = true
    void fetchCategories().then((d) => {
      if (live && d) setCategories(d)
    })
    return () => {
      live = false
    }
  }, [])
  return categories
}
