import { getSupabase } from './supabaseClient'

/** Email magic link: the person gets a link; opening it signs them in on this site. */
export async function signInWithEmail(email: string): Promise<void> {
  const client = getSupabase()
  if (!client) throw new Error('The shared database is not set up.')
  const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin } })
  if (error) throw error
}

/** Email and password, which the browser's password manager can save and fill in next time. */
export async function signInWithPassword(email: string, password: string): Promise<void> {
  const client = getSupabase()
  if (!client) throw new Error('The shared database is not set up.')
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw new Error(passwordErrorText(error.message))
}

/** Sets or changes the password of the signed-in person (after signing in once with an emailed link). */
export async function setPassword(password: string): Promise<void> {
  const client = getSupabase()
  if (!client) throw new Error('The shared database is not set up.')
  const { error } = await client.auth.updateUser({ password })
  if (error) throw new Error(passwordErrorText(error.message))
}

/** Supabase's messages, in the app's words where they are likely to be seen. */
export function passwordErrorText(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return 'That email and password do not match. If you have not set a password yet, use "Email me a sign-in link" below.'
  }
  if (/email not confirmed/i.test(message)) return 'This email address is not confirmed yet. Use "Email me a sign-in link" below.'
  if (/should be different/i.test(message)) return 'That is already your password.'
  if (/at least \d+ characters|weak password|password should/i.test(message)) return `The password is too short or too simple. ${message}`
  return message
}

export async function signOut(): Promise<void> {
  await getSupabase()?.auth.signOut()
}
