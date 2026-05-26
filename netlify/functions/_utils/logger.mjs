export async function writeLog(event, payload, level = 'error') {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return

  try {
    await fetch(`${supabaseUrl}/rest/v1/app_logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ event, level, payload }),
    })
  } catch {
    // Silently swallow
  }
}
