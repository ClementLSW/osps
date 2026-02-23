import { useState } from 'react'
import AuthModal from '@/components/auth/AuthModal'
import Footer from '@/components/Footer'

const FEATURES = [
  {
    emoji: '⚡',
    title: '5 split modes',
    desc: 'Equal, exact amounts, percentage, shares, or itemised — however your group rolls.',
  },
  {
    emoji: '🧮',
    title: 'Smart balances',
    desc: 'Automatically works out who owes who with minimum transactions.',
  },
  {
    emoji: '🔗',
    title: 'Invite by link',
    desc: 'Share a link, friends join instantly. No app store, no downloads.',
  },
  {
    emoji: '🔒',
    title: 'No ads, no tracking',
    desc: 'Open source and free. Your data stays yours.',
  },
]

const STEPS = [
  { num: '1', text: 'Create a group for your trip, household, or dinner' },
  { num: '2', text: 'Log expenses and choose how to split them' },
  { num: '3', text: 'See who owes who and settle up' },
]

export default function Landing() {
  const [authModal, setAuthModal] = useState(null) // null | 'signin' | 'signup'

  return (
    <div className="min-h-screen flex flex-col">
      {/* ─── Nav ─── */}
      <nav className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-display font-extrabold text-osps-red tracking-tight">
            O$P$
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAuthModal('signin')}
            className="btn-ghost text-sm py-2 px-4"
          >
            Sign in
          </button>
          <button
            onClick={() => setAuthModal('signup')}
            className="btn-primary text-sm py-2 px-4"
          >
            Get started
          </button>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pt-8 sm:pt-16 pb-16">
        <div className="text-center max-w-2xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 bg-osps-red/10 border border-osps-red/15 text-osps-red
                          text-xs font-display font-semibold px-3 py-1 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-osps-red rounded-full" />
            Free &amp; open source
          </div>

          <h1 className="text-4xl sm:text-6xl font-display font-extrabold text-osps-black tracking-tight leading-[1.1]">
            Owe Money,{' '}
            <span className="text-osps-red">Pay Money.</span>
          </h1>

          <p className="text-lg sm:text-xl text-osps-gray font-body mt-4 sm:mt-6 max-w-lg mx-auto leading-relaxed">
            The fuss-free way to split expenses with friends.
            Track bills, settle debts, stay friends.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            <button
              onClick={() => setAuthModal('signup')}
              className="btn-primary text-base px-8 py-3.5 w-full sm:w-auto"
            >
              Start splitting — it's free
            </button>
            <a
              href="#how-it-works"
              className="btn-ghost text-base py-3.5 w-full sm:w-auto text-center"
            >
              See how it works ↓
            </a>
          </div>
        </div>

        {/* ─── Category pills ─── */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-12 sm:mt-16 max-w-md mx-auto">
          {[
            ['🏠', 'Household'],
            ['✈️', 'Trip'],
            ['🍽️', 'Dinner'],
            ['🎉', 'Event'],
            ['💼', 'Work'],
            ['🎲', 'Other'],
          ].map(([emoji, label]) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 bg-white border border-osps-gray-light
                         text-sm font-body text-osps-black px-3 py-1.5 rounded-full shadow-sm"
            >
              <span>{emoji}</span>
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section id="how-it-works" className="px-4 sm:px-6 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-osps-black text-center mb-10 sm:mb-12">
            Splitting bills shouldn't be awkward
          </h2>

          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
            {STEPS.map(({ num, text }) => (
              <div key={num} className="text-center sm:text-left">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full
                                bg-osps-red text-white font-display font-bold text-sm mb-3">
                  {num}
                </div>
                <p className="font-body text-osps-black leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-osps-black text-center mb-10 sm:mb-12">
            Everything you need, nothing you don't
          </h2>

          <div className="grid sm:grid-cols-2 gap-6">
            {FEATURES.map(({ emoji, title, desc }) => (
              <div key={title} className="flex gap-4 p-4 rounded-2xl hover:bg-osps-cream/60 transition-colors">
                <span className="text-2xl flex-shrink-0 mt-0.5">{emoji}</span>
                <div>
                  <h3 className="font-display font-semibold text-osps-black">{title}</h3>
                  <p className="text-sm text-osps-gray font-body mt-1 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="px-4 sm:px-6 py-16 sm:py-20 text-center">
        <div className="max-w-lg mx-auto">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-osps-black mb-4">
            Ready to stop chasing payments?
          </h2>
          <p className="text-osps-gray font-body mb-8">
            Create your first group in seconds. Free forever, no catch.
          </p>
          <button
            onClick={() => setAuthModal('signup')}
            className="btn-primary text-base px-8 py-3.5"
          >
            Get started — it's free
          </button>
        </div>
      </section>

      <Footer />

      {/* ─── Auth Modal ─── */}
      {authModal && (
        <AuthModal
          initialMode={authModal}
          onClose={() => setAuthModal(null)}
        />
      )}
    </div>
  )
}
