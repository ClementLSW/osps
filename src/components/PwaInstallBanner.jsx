import { useState, useEffect } from 'react'

const STORAGE_KEY = 'osps_pwa_banner_dismissed'

function getPlatform() {
  const ua = navigator.userAgent || ''
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return null
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    navigator.standalone === true // iOS Safari
  )
}

export default function PwaInstallBanner() {
  const [visible, setVisible] = useState(false)
  const [platform, setPlatform] = useState(null)

  useEffect(() => {
    const plat = getPlatform()
    if (!plat) return                                       // not mobile
    if (isStandalone()) return                              // already installed
    if (localStorage.getItem(STORAGE_KEY) === 'true') return // previously dismissed

    setPlatform(plat)
    // Small delay so it doesn't flash on page load
    const timer = setTimeout(() => setVisible(true), 1500)
    return () => clearTimeout(timer)
  }, [])

  function dismiss() {
    setVisible(false)
    localStorage.setItem(STORAGE_KEY, 'true')
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 px-4 pb-safe animate-slideUp">
      <div className="max-w-lg mx-auto bg-white rounded-2xl border border-osps-gray-light
                      shadow-lg p-4 flex items-start gap-3">
        {/* Icon */}
        <div className="shrink-0 w-10 h-10 rounded-xl bg-osps-red/10 flex items-center justify-center">
          <span className="text-lg">📲</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-sm text-osps-black">
            Add O$P$ to your home screen
          </p>
          <p className="text-xs text-osps-gray font-body mt-0.5 leading-relaxed">
            {platform === 'ios'
              ? <>Tap <span className="font-semibold text-osps-black">Share</span> then <span className="font-semibold text-osps-black">Add to Home Screen</span></>
              : <>Tap <span className="font-semibold text-osps-black">⋮</span> then <span className="font-semibold text-osps-black">Add to Home Screen</span></>
            }
          </p>
        </div>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full
                     text-osps-gray hover:bg-osps-black/5 transition-colors -mt-0.5 -mr-1"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slideUp { animation: slideUp 0.25s ease-out; }
      `}</style>
    </div>
  )
}
