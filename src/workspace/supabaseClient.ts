import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Drops spaces and quotes around a setting typed by hand into Vercel. */
export function cleanSetting(raw: string | undefined): string {
  return (raw ?? '').trim().replace(/^["']|["']$/g, '').trim()
}

/**
 * The project address, tidied: a missing "https://" is added and anything after the address (such as /rest/v1/) is
 * cut off. Null when what is left is still not a web address.
 */
export function cleanSupabaseUrl(raw: string | undefined): string | null {
  const text = cleanSetting(raw)
  if (!text) return null
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
    // Browsers accept odd hosts such as "not%20a%20url", so check it is a plain host name.
    return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) || url.hostname === 'localhost' ? url.origin : null
  } catch {
    return null
  }
}

const rawUrl = cleanSetting(import.meta.env.VITE_SUPABASE_URL as string | undefined)
const key = cleanSetting(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
const url = cleanSupabaseUrl(rawUrl)

/** True when both settings are present; otherwise the app keeps everything in this browser, as before. */
export const supabaseConfigured = Boolean(rawUrl && key)

let client: SupabaseClient | null = null
let problem: string | null =
  supabaseConfigured && !url ? 'VITE_SUPABASE_URL is not a web address. It should look like https://abcd.supabase.co.' : null

/** The client, or null when the settings are missing or unusable (the app then keeps working in this browser). */
export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured || !url || problem) return null
  if (!client) {
    try {
      client = createClient(url, key)
    } catch (error) {
      // A bad setting must never blank the whole app: remember what is wrong and fall back to this browser's storage.
      problem = error instanceof Error ? error.message : String(error)
      return null
    }
  }
  return client
}

/** Why the shared database settings could not be used, or null. */
export function supabaseSettingsProblem(): string | null {
  getSupabase()
  return problem
}
