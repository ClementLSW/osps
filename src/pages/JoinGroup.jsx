import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSupabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'

export default function JoinGroup() {
  const { inviteCode } = useParams()
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()
  const [joining, setJoining] = useState(false)
  const [groupName, setGroupName] = useState(null)

  useEffect(() => {
    // Look up group name for the invite code
    getSupabase()
      .from('groups')
      .select('id, name')
      .eq('invite_code', inviteCode)
      .single()
      .then(({ data }) => {
        if (data) setGroupName(data.name)
      })
  }, [inviteCode])

  useEffect(() => {
    // Auto-join once authenticated
    if (user && profile && !authLoading) {
      joinGroup()
    }
  }, [user, profile, authLoading])

  async function joinGroup() {
    setJoining(true)

    // Find group by invite code
    const { data: group, error: groupError } = await getSupabase()
      .from('groups')
      .select('id')
      .eq('invite_code', inviteCode)
      .single()

    if (groupError || !group) {
      toast.error('Invalid invite link')
      navigate('/')
      return
    }

    // Check if already a member
    const { data: existing } = await getSupabase()
      .from('group_members')
      .select('group_id')
      .eq('group_id', group.id)
      .eq('user_id', profile.id)
      .single()

    if (existing) {
      toast('You\'re already in this group!')
      navigate(`/group/${group.id}`)
      return
    }

    // Join the group
    const { error: joinError } = await getSupabase()
      .from('group_members')
      .insert({ group_id: group.id, user_id: profile.id, role: 'member' })

    if (joinError) {
      toast.error('Failed to join group')
      console.error(joinError)
    } else {
      toast.success('Joined the group!')
      navigate(`/group/${group.id}`)
    }
  }

  if (authLoading || joining) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-display font-bold text-osps-red mb-2">O$P$</h1>
          <p className="text-osps-gray">
            {authLoading ? 'Loading...' : `Joining ${groupName || 'group'}...`}
          </p>
        </div>
      </div>
    )
  }

  // Not logged in — prompt to sign in first
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-3xl font-display font-bold text-osps-red mb-2">O$P$</h1>
          {groupName && (
            <p className="text-osps-gray mb-6">
              You've been invited to join <span className="font-semibold text-osps-black">{groupName}</span>
            </p>
          )}
          <p className="text-sm text-osps-gray mb-4">Sign in or create an account to join.</p>
          <button
            onClick={() => {
              sessionStorage.setItem('osps-return-to', `/join/${inviteCode}`)
              navigate('/')
            }}
            className="btn-primary"
          >
            Sign in to join
          </button>
        </div>
      </div>
    )
  }

  return null
}
