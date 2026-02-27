import { useState, useEffect, useCallback } from 'react'
import type { Alias, IpcResponse } from '../types/electron'

export function useAliases() {
  const [aliases,   setAliases]   = useState<Alias[]>([])
  const [shellFile, setShellFile] = useState('')
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.aliasAPI.getAll()
      if (!result.success) throw new Error(result.error)
      setAliases(result.aliases ?? [])
      // Use the display-friendly path (with ~) from the main process
      setShellFile(result.shellFileDisplay || result.shellFile || '')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function saveAlias(alias: Alias): Promise<IpcResponse> {
    const result = await window.aliasAPI.save(alias)
    if (result.success) await load()  // Refresh list from file
    return result
  }

  async function deleteAlias(name: string): Promise<IpcResponse> {
    const result = await window.aliasAPI.delete(name)
    if (result.success) await load()
    return result
  }

  return {
    aliases,
    shellFile,
    loading,
    error,
    reload: load,
    saveAlias,
    deleteAlias,
  }
}
