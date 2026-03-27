import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { requestJson, setAuthToken } from '../lib/api'

export default function AuthPage({ authUser, setAuthUser }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (authUser) {
    return <Navigate to="/app" replace />
  }

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/signup'
      const payload = { email, password }
      if (mode === 'signup') {
        payload.display_name = displayName || 'User'
      }

      const res = await requestJson(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }, 0, 30000)

      setAuthToken(res?.token || null)
      setAuthUser(res?.user || null)
    } catch (err) {
      setError(err?.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a1020] text-white grid place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h1>
          <Link to="/" className="text-sm text-cyan-300 hover:text-cyan-200">Home</Link>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === 'signup' && (
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name"
              className="w-full rounded-lg bg-[#111a32] border border-white/10 px-3 py-2"
              required
            />
          )}

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-lg bg-[#111a32] border border-white/10 px-3 py-2"
            required
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            minLength={8}
            className="w-full rounded-lg bg-[#111a32] border border-white/10 px-3 py-2"
            required
          />

          {error && <p className="text-sm text-red-300">{error}</p>}

          <button
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-[#2D88FF] to-[#2AE7C9] px-4 py-2 font-semibold text-[#04111e] disabled:opacity-50"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Sign Up'}
          </button>
        </form>

        <button
          className="mt-4 text-sm text-gray-300 hover:text-white"
          onClick={() => {
            setMode((prev) => (prev === 'login' ? 'signup' : 'login'))
            setError('')
          }}
        >
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Login'}
        </button>
      </div>
    </div>
  )
}
