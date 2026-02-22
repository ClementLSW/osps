/**
 * Format a date string into a human-friendly relative label.
 *
 *   today        → "Today"
 *   yesterday    → "Yesterday"
 *   2-6 days ago → "2d ago", "3d ago", etc.
 *   this year    → "15 Jan"
 *   older        → "15 Jan 2025"
 *
 * @param {string} dateStr — ISO date string (e.g. "2026-02-22")
 * @returns {string}
 */
export function formatRelativeDate(dateStr) {
  if (!dateStr) return ''

  // Parse as local date (expense_date is a date column, no timezone)
  const date = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  const diffDays = Math.round((today - target) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays >= 2 && diffDays <= 6) return `${diffDays}d ago`

  const sameYear = date.getFullYear() === now.getFullYear()
  const day = date.getDate()
  const month = date.toLocaleDateString('en-SG', { month: 'short' })

  return sameYear ? `${day} ${month}` : `${day} ${month} ${date.getFullYear()}`
}
