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

/** True for a key that must never reach a browser: a secret key, or an old-style service_role key. */
export function isSecretKey(value: string): boolean {
  if (/^sb_secret_/i.test(value)) return true
  const payload = value.split('.')[1]
  if (!payload) return false
  try {
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role'
  } catch {
    return false
  }
}

/** What is wrong with the two settings, in words for the banner, or null when they look usable. */
export function settingsProblem(rawUrl: string, key: string): string | null {
  if (!rawUrl || !key) return null
  // A secret key bypasses every sign-in rule in the database, so the app refuses to use it at all.
  if (isSecretKey(key) || isSecretKey(rawUrl)) {
    return 'A secret key was put in the app settings. It is not used. Revoke it in Supabase and use the publishable (anon) key instead.'
  }
  if (!cleanSupabaseUrl(rawUrl)) {
    return /^(sb_publishable_|eyJ)/.test(rawUrl)
      ? 'VITE_SUPABASE_URL holds a key, not the address. It should look like https://abcd.supabase.co.'
      : 'VITE_SUPABASE_URL is not a web address. It should look like https://abcd.supabase.co.'
  }
  return null
}

let client: SupabaseClient | null = null
let problem: string | null = settingsProblem(rawUrl, key)

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
