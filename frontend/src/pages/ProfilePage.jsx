import { Link, Navigate } from 'react-router-dom'

export default function ProfilePage({ authContext }) {
  const user = authContext?.authUser

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-gray-100 p-6 md:p-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Profile</h1>
        <Link to="/app" className="rounded-lg border border-white/10 px-3 py-2 text-sm">Dashboard</Link>
      </div>

      <div className="max-w-xl rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
        <div>
          <p className="text-sm text-gray-400">Display Name</p>
          <p className="text-lg font-semibold">{user.display_name}</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Email</p>
          <p className="text-lg font-semibold">{user.email}</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">User ID</p>
          <p className="text-sm font-mono break-all text-gray-300">{user.id}</p>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link to="/analytics" className="rounded-lg bg-[#1b2a4a] px-3 py-2 text-sm">Analytics</Link>
          <Link to="/review" className="rounded-lg bg-[#1b2a4a] px-3 py-2 text-sm">Daily Review</Link>
          <button
            className="rounded-lg bg-red-600/20 border border-red-400/30 px-3 py-2 text-sm text-red-200"
            onClick={authContext.logout}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}
