import { useScrollLock } from '@/hooks/useScrollLock'

/**
 * ConfirmDialog — reusable modal for destructive actions.
 *
 * Props:
 *   title         — heading text
 *   message       — body text explaining what will happen
 *   confirmLabel  — text on the confirm button (default: "Delete")
 *   danger        — if true, confirm button is red (default: true)
 *   onConfirm     — called when user confirms
 *   onCancel      — called when user cancels (backdrop click or cancel button)
 */

export default function ConfirmDialog({
  title = 'Are you sure?',
  message,
  confirmLabel = 'Delete',
  danger = true,
  onConfirm,
  onCancel,
}) {
  useScrollLock()
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-osps-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />

      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm mx-0 sm:mx-4 p-6 shadow-xl animate-slideUp">
        <h2 className="text-lg font-display font-bold text-osps-black mb-2">
          {title}
        </h2>
        {message && (
          <p className="text-sm text-osps-gray font-body mb-6">
            {message}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="btn-ghost flex-1 text-sm py-2.5"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 font-display font-semibold text-sm py-2.5 rounded-xl
                       active:scale-[0.98] transition-all duration-150
                       ${danger
                         ? 'bg-osps-red text-white hover:bg-osps-red-dark'
                         : 'bg-osps-black text-white hover:bg-osps-black/90'
                       }`}
          >
            {confirmLabel}
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
    </div>
  )
}
