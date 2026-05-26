import { getSupabase } from '@/lib/supabase'

/**
 * Event catalogue:
 * - ocr.success (info): model, currency, date, total, item_count, had_fallback, duration_ms
 * - ocr.error (error): model, stage, error, raw_snippet
 * - fx.error (error): from, to, date, is_historical, http_status, error
 * - expense.save_error (error): stage ('expense'|'splits'), group_id, error
 * - invite.error (error): stage, group_id, error
 * - auth.error (error): stage, error
 */

/**
 * Write a log entry to app_logs. Fire-and-forget — never throws.
 *
 * @param {string} event
 * @param {object} payload
 * @param {'info'|'warn'|'error'} [level='error']
 */
export async function log(event, payload, level = 'error') {
  try {
    await getSupabase()
      .from('app_logs')
      .insert({ event, level, payload })
    // user_id is resolved server-side via auth.uid() from the JWT
  } catch {
    // Silently swallow — logging must never surface errors to the user
  }
}
