import { describe, expect, it } from 'vitest'
import { cleanSetting, cleanSupabaseUrl, isSecretKey, settingsProblem } from './supabaseClient'

describe('Supabase settings typed into Vercel', () => {
  it('accepts the address with or without https:// and drops spaces, quotes and paths', () => {
    expect(cleanSupabaseUrl('https://abcd.supabase.co')).toBe('https://abcd.supabase.co')
    expect(cleanSupabaseUrl('abcd.supabase.co')).toBe('https://abcd.supabase.co')
    expect(cleanSupabaseUrl(' "https://abcd.supabase.co/" ')).toBe('https://abcd.supabase.co')
    expect(cleanSupabaseUrl('https://abcd.supabase.co/rest/v1/')).toBe('https://abcd.supabase.co')
  })

  it('returns null for something that is not a web address', () => {
    expect(cleanSupabaseUrl('')).toBeNull()
    expect(cleanSupabaseUrl(undefined)).toBeNull()
    expect(cleanSupabaseUrl('not a url')).toBeNull()
  })

  it('trims the key', () => {
    expect(cleanSetting(" 'eyJhbGci' ")).toBe('eyJhbGci')
  })
})

describe('settings that must not be used', () => {
  const serviceRoleJwt = `x.${btoa(JSON.stringify({ role: 'service_role' }))}.y`
  const anonJwt = `x.${btoa(JSON.stringify({ role: 'anon' }))}.y`

  it('refuses a secret key or a service_role key', () => {
    expect(isSecretKey('sb_secret_abc')).toBe(true)
    expect(isSecretKey(serviceRoleJwt)).toBe(true)
    expect(isSecretKey('sb_publishable_abc')).toBe(false)
    expect(isSecretKey(anonJwt)).toBe(false)
    expect(settingsProblem('https://abcd.supabase.co', 'sb_secret_abc')).toMatch(/secret key/)
  })

  it('says when the address box holds a key', () => {
    expect(settingsProblem('sb_publishable_abc', 'sb_secret_abc')).toMatch(/secret key/)
    expect(settingsProblem('sb_publishable_abc', 'https://abcd.supabase.co')).toMatch(/holds a key/)
    expect(settingsProblem('https://abcd.supabase.co', 'sb_publishable_abc')).toBeNull()
  })
})
