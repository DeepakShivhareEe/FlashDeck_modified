import { useCallback, useRef, useState } from 'react'

export function useAsyncAction(action, options = {}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const lastArgsRef = useRef(null)
  const retriesRef = useRef(0)

  const execute = useCallback(async (...args) => {
    lastArgsRef.current = args
    setLoading(true)
    setError('')

    try {
      const result = await action(...args)
      retriesRef.current = 0
      return result
    } catch (err) {
      const message = err?.message || options.defaultError || 'Something went wrong'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [action, options.defaultError])

  const retry = useCallback(async () => {
    if (!lastArgsRef.current) return null
    if (options.maxRetries && retriesRef.current >= options.maxRetries) {
      throw new Error('Retry limit reached')
    }
    retriesRef.current += 1
    return execute(...lastArgsRef.current)
  }, [execute, options.maxRetries])

  return {
    execute,
    retry,
    loading,
    error,
    clearError: () => setError(''),
  }
}
