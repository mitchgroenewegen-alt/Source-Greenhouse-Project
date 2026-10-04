import { getSupabase } from './supabaseClient'

/** Email magic link: the person gets a link; opening it signs them in on this site. */
export async function signInWithEmail(email: string): Promise<void> {
  const client = getSupabase()
  if (!client) throw new Error('The shared database is not set up.')
  const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  await getSupabase()?.auth.signOut()
}
