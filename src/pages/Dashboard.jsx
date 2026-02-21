import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'

export default function Dashboard() {
  const { profile, signOut } = useAuth()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchGroups()
  }, [])

  async function fetchGroups() {
    const { data, error } = await supabase
      .from('group_members')
      .select(`
        group_id,
        role,
        groups:group_id (
          id, name, currency, invite_code, is_settled, created_at
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

  async function createGroup(e) {
    e.preventDefault()
    if (!newGroupName.trim()) return
    setCreating(true)

    const { data: group, error } = await supabase
      .from('groups')
      .insert({ name: newGroupName.trim(), created_by: profile.id })
      .select()
      .single()

    if (error) {
      toast.error('Failed to create group')
      console.error(error)
      setCreating(false)
      return
    }

    // Add creator as admin member
    await supabase.from('group_members').insert({
      group_id: group.id,
      user_id: profile.id,
      role: 'admin',
    })

    toast.success('Group created!')
    setNewGroupName('')
    setShowCreate(false)
    setCreating(false)
    fetchGroups()
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-osps-red">O$P$</h1>
          <p className="text-sm text-osps-gray">Hi, {profile?.display_name}</p>
        </div>
        <button onClick={signOut} className="btn-ghost text-sm">
          Sign out
        </button>
      </div>

      {/* Create group */}
      {showCreate ? (
        <form onSubmit={createGroup} className="card mb-6 flex gap-3">
          <input
            type="text"
            placeholder="Group name..."
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            className="input flex-1"
            autoFocus
          />
          <button type="submit" className="btn-primary text-sm" disabled={creating}>
            Create
          </button>
          <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost text-sm">
            Cancel
          </button>
        </form>
      ) : (
        <button onClick={() => setShowCreate(true)} className="btn-primary w-full mb-6">
          + New Group
        </button>
      )}

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
          <p className="text-sm mt-1">Create one or ask a friend for an invite link.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(group => (
            <Link key={group.id} to={`/group/${group.id}`} className="card block hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-semibold">{group.name}</h3>
                  <p className="text-xs text-osps-gray mt-1">{group.currency}</p>
                </div>
                {group.is_settled && (
                  <span className="text-xs bg-osps-green/10 text-osps-green px-2 py-1 rounded-full font-medium">
                    Settled
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
