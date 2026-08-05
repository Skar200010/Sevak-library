import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient.js'

export function useApps(enabled = true) {
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError('')
    try {
      const { data, error: e } = await supabase
        .from('applications')
        .select('*')
        .order('created_at', { ascending: false })
      if (e) throw new Error(e.message)
      setRows(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { rows, loading, error, refresh }
}
