import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSupabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'

const CATEGORY_EMOJI = {
  Household: '🏠',
  Trip: '✈️',
  Dinner: '🍽️',
  Event: '🎉',
  Work: '💼',
  Other: '🎲',
}

export default function Dashboard() {
  const { profile, signOut } = useAuth()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchGroups()
  }, [])

  async function fetchGroups() {
    const { data, error } = await getSupabase()
      .from('group_members')
      .select(`
        group_id,
        role,
        groups:group_id (
          id, name, currency, category, type, start_date, end_date, invite_code, is_settled, created_at
        )
      `)
      .eq('user_id', profile?.id)
      .order('joined_at', { ascending: false })

    if (error) {
      toast.error('Failed to load groups')
      console.error(error)
    } else {
      setGroups(data?.map(d => ({ ...d.groups, role: d.role })) || [])
    }
    setLoading(false)
  }

  const activeGroups = groups.filter(g => !g.is_settled)
  const settledGroups = groups.filter(g => g.is_settled)

  return (
    <div className="max-w-lg mx-auto px-4 py-8 pb-safe">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-osps-red">O$P$</h1>
          <p className="text-sm text-osps-gray font-body">Hi, {profile?.display_name}</p>
        </div>
        <button onClick={signOut} className="btn-ghost text-sm">
          Sign out
        </button>
      </div>

      {/* Create group */}
      <Link to="/create" className="btn-primary w-full text-center block mb-6">
        + New Group
      </Link>

      {/* Group list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card animate-pulse h-20" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 text-osps-gray">
          <p className="text-4xl mb-3">💸</p>
          <p className="font-display font-medium">No groups yet</p>
          <p className="text-sm mt-1 font-body">Create one or ask a friend for an invite link.</p>
        </div>
      ) : (
        <>
          {activeGroups.length > 0 && (
            <div className="space-y-3 mb-8">
              {activeGroups.map(group => (
                <Link key={group.id} to={`/group/${group.id}`} className="card block hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {CATEGORY_EMOJI[group.category] || '💸'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-semibold truncate">{group.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-osps-gray font-body">{group.currency}</span>
                        {group.type !== 'ongoing' && group.start_date && (
                          <>
                            <span className="text-xs text-osps-gray">·</span>
                            <span className="text-xs text-osps-gray font-body">
                              {formatDateRange(group.start_date, group.end_date)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="text-osps-gray-light text-lg">›</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {settledGroups.length > 0 && (
            <>
              <h2 className="text-xs font-display font-semibold text-osps-gray uppercase tracking-wider mb-3">
                Settled
              </h2>
              <div className="space-y-3">
                {settledGroups.map(group => (
                  <Link key={group.id} to={`/group/${group.id}`} className="card block opacity-60 hover:opacity-80 transition-opacity">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {CATEGORY_EMOJI[group.category] || '💸'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display font-semibold truncate">{group.name}</h3>
                        <span className="text-xs text-osps-gray font-body">{group.currency}</span>
                      </div>
                      <span className="text-xs bg-osps-green/10 text-osps-green px-2 py-1 rounded-full font-display font-medium">
                        Settled
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function formatDateRange(start, end) {
  const fmt = (d) => {
    const date = new Date(d + 'T00:00:00')
    return date.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
  }
  if (!start) return ''
  if (!end || start === end) return fmt(start)
  return `${fmt(start)} – ${fmt(end)}`
}
