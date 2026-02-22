import { useEffect } from 'react'

/**
 * Lock body scroll while this component is mounted.
 * Used by modals (InviteModal, ConfirmDialog, GroupSettingsPanel)
 * to prevent background scrolling on mobile.
 */
export function useScrollLock() {
  useEffect(() => {
    document.body.classList.add('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [])
}
