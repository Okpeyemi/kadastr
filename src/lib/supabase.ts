import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export function getAnonClient () {
	if (!url || !anon) {
		throw new Error('Supabase URL/Anon key manquants dans .env.local')
	}
	return createClient(url, anon, { auth: { persistSession: false } })
}

export function getAdminClient () {
	if (!url || !service) {
		throw new Error('Supabase URL/Service key manquants dans .env.local')
	}
	return createClient(url, service, { auth: { persistSession: false } })
}
