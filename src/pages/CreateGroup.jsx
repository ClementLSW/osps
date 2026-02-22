import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSupabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'

const CURRENCIES = [
  { code: 'SGD', flag: '🇸🇬' },
  { code: 'USD', flag: '🇺🇸' },
  { code: 'MYR', flag: '🇲🇾' },
  { code: 'THB', flag: '🇹🇭' },
  { code: 'JPY', flag: '🇯🇵' },
  { code: 'EUR', flag: '🇪🇺' },
  { code: 'KRW', flag: '🇰🇷' },
  { code: 'IDR', flag: '🇮🇩' },
]

const PRESETS = [
  { emoji: '🏠', label: 'Household', type: 'ongoing' },
  { emoji: '✈️', label: 'Trip', type: 'trip' },
  { emoji: '🍽️', label: 'Dinner', type: 'event' },
  { emoji: '🎉', label: 'Event', type: 'event' },
  { emoji: '💼', label: 'Work', type: 'ongoing' },
  { emoji: '🎲', label: 'Other', type: 'ongoing' },
]

export default function CreateGroup() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [preset, setPreset] = useState(null)
  const [currency, setCurrency] = useState('SGD')
  const [showCurrency, setShowCurrency] = useState(false)
  const [hasDateRange, setHasDateRange] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [creating, setCreating] = useState(false)

  const selectedPreset = PRESETS.find(p => p.label === preset)
  const isTimeBound = selectedPreset?.type === 'trip' || selectedPreset?.type === 'event'

  function handlePresetSelect(p) {
    setPreset(p.label)
    setHasDateRange(p.type !== 'ongoing')
    setTimeout(() => setStep(1), 200)
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim() || !preset) return
    setCreating(true)

    const { data: group, error } = await getSupabase()
      .from('groups')
      .insert({
        name: name.trim(),
        currency,
        created_by: profile.id,
        type: selectedPreset?.type || 'ongoing',
        category: preset,
        start_date: hasDateRange && startDate ? startDate : null,
        end_date: hasDateRange && endDate ? endDate : null,
      })
      .select()
      .single()

    if (error) {
      toast.error('Failed to create group')
      console.error(error)
      setCreating(false)
      return
    }

    // Add creator as admin
    const { error: memberError } = await getSupabase()
      .from('group_members')
      .insert({
        group_id: group.id,
        user_id: profile.id,
        role: 'admin',
      })

    if (memberError) {
      toast.error('Failed to add you to group')
      console.error(memberError)
      setCreating(false)
      return
    }

    toast.success('Group created!')
    navigate(`/group/${group.id}`)
  }

  const canCreate = name.trim().length > 0

  return (
    <div className="min-h-screen bg-osps-cream">
      <div className="max-w-md mx-auto px-4 pt-6 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => step > 0 ? setStep(0) : navigate('/dashboard')}
            className="text-sm text-osps-gray hover:text-osps-black transition-colors"
          >
            ← {step > 0 ? 'Back' : 'Dashboard'}
          </button>
          <span className="text-xl font-display font-extrabold text-osps-red tracking-tight">
            O$P$
          </span>
          <div className="w-10" />
        </div>

        {/* Progress bar */}
        <div className="h-[3px] bg-osps-gray-light rounded-full mb-10 overflow-hidden">
          <div
            className="h-full bg-osps-red rounded-full transition-all duration-400 ease-out"
            style={{ width: step === 0 ? '50%' : '100%' }}
          />
        </div>

        {/* Step 0: Category */}
        {step === 0 && (
          <div className="animate-fadeUp">
            <h1 className="text-3xl font-display font-extrabold text-osps-black tracking-tight leading-tight mb-1">
              What's this for?
            </h1>
            <p className="text-osps-gray text-[15px] font-body mb-8">
              Pick a category. You can change this later.
            </p>

            <div className="grid grid-cols-3 gap-3">
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => handlePresetSelect(p)}
                  className={`flex flex-col items-center gap-2 py-5 px-3 rounded-2xl border-2 transition-all duration-150
                    ${preset === p.label
                      ? 'bg-osps-black text-white border-osps-black'
                      : 'bg-white text-osps-black border-osps-gray-light hover:border-osps-black/20'
                    }`}
                >
                  <span className="text-[28px]">{p.emoji}</span>
                  <span className="text-[13px] font-display font-semibold">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Details */}
        {step === 1 && (
          <form onSubmit={handleCreate} className="animate-fadeUp">
            <h1 className="text-3xl font-display font-extrabold text-osps-black tracking-tight leading-tight mb-1">
              {preset === 'Trip' ? "Where to?" :
               preset === 'Dinner' ? "What's the occasion?" :
               preset === 'Event' ? "What's happening?" :
               'Name your group'}
            </h1>
            <p className="text-osps-gray text-[15px] font-body mb-7">
              Give it a name your friends will recognize.
            </p>

            {/* Group name */}
            <div className="mb-5">
              <label className="block text-xs font-display font-semibold text-osps-gray uppercase tracking-wider mb-2">
                Name
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">
                  {selectedPreset?.emoji || '📋'}
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={
                    preset === 'Trip' ? 'e.g. Bali 2026' :
                    preset === 'Household' ? 'e.g. Clementi Ave 3' :
                    preset === 'Dinner' ? 'e.g. Birthday dinner' :
                    preset === 'Work' ? 'e.g. Team lunch' :
                    'e.g. Weekend hangout'
                  }
                  className="input pl-12 text-[17px] font-display font-medium"
                  autoFocus
                />
              </div>
            </div>

            {/* Currency */}
            <div className="mb-5">
              <label className="block text-xs font-display font-semibold text-osps-gray uppercase tracking-wider mb-2">
                Currency
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCurrency(!showCurrency)}
                  className="input flex items-center justify-between text-[15px]"
                >
                  <span>
                    {CURRENCIES.find(c => c.code === currency)?.flag} {currency}
                  </span>
                  <span className={`text-osps-gray text-xs transition-transform duration-200 ${showCurrency ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>

                {showCurrency && (
                  <div className="absolute top-full mt-1 left-0 right-0 bg-white rounded-xl border border-osps-gray-light p-1.5 z-10 shadow-lg max-h-[200px] overflow-y-auto animate-fadeUp">
                    {CURRENCIES.map(c => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => { setCurrency(c.code); setShowCurrency(false) }}
                        className={`w-full px-3 py-2.5 rounded-lg flex items-center gap-2.5 text-sm font-body text-left transition-colors
                          ${currency === c.code ? 'bg-osps-cream font-semibold' : 'hover:bg-osps-cream/50'}`}
                      >
                        <span className="text-lg">{c.flag}</span>
                        <span>{c.code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Date toggle */}
            <div className="mb-5">
              <button
                type="button"
                onClick={() => setHasDateRange(!hasDateRange)}
                className="flex items-center gap-3 py-1"
              >
                <div className={`w-11 h-[26px] rounded-full p-[3px] transition-colors duration-200 ${hasDateRange ? 'bg-osps-red' : 'bg-osps-gray-light'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${hasDateRange ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                </div>
                <div className="text-left">
                  <span className="block text-sm font-display font-semibold text-osps-black">
                    Add dates
                  </span>
                  <span className="block text-xs text-osps-gray font-body">
                    Get daily summaries &amp; settle at the end
                  </span>
                </div>
              </button>
            </div>

            {/* Date inputs */}
            {hasDateRange && (
              <div className="flex gap-3 mb-5 animate-fadeUp">
                <div className="flex-1">
                  <label className="block text-xs font-display font-semibold text-osps-gray uppercase tracking-wider mb-1.5">
                    Start
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="input text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-display font-semibold text-osps-gray uppercase tracking-wider mb-1.5">
                    End
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="input text-sm"
                  />
                </div>
              </div>
            )}

            {/* Info card for trips */}
            {hasDateRange && (
              <div className="bg-osps-red/5 border border-osps-red/10 rounded-2xl px-4 py-3.5 mb-6 animate-fadeUp">
                <p className="text-[13px] text-osps-black font-body leading-relaxed">
                  📋 <strong>Daily checkpoints</strong> — at the end of each day, everyone confirms expenses while memory's fresh. No more arguments at settlement time.
                </p>
              </div>
            )}

            {/* Create button */}
            <button
              type="submit"
              disabled={!canCreate || creating}
              className={`w-full py-4 rounded-2xl text-base font-display font-bold transition-all duration-150
                ${canCreate && !creating
                  ? 'bg-osps-red text-white hover:bg-osps-red-dark active:scale-[0.98]'
                  : 'bg-osps-gray-light text-osps-gray cursor-not-allowed'
                }`}
            >
              {creating ? 'Creating...' : 'Create group'}
            </button>
          </form>
        )}
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeUp {
          animation: fadeUp 0.35s ease-out;
        }
      `}</style>
    </div>
  )
}
