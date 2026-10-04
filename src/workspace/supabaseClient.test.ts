import { describe, expect, it } from 'vitest'
import { cleanSetting, cleanSupabaseUrl } from './supabaseClient'

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
