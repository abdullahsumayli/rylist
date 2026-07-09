import { createClient } from "./vendor/supabase.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export async function signIn(email, password){ return sb.auth.signInWithPassword({ email, password }); }
export async function signOut(){ return sb.auth.signOut(); }
export async function currentUser(){ const { data } = await sb.auth.getUser(); return data.user; }
export async function isAdmin(){ const { data, error } = await sb.rpc("is_admin"); return !error && data === true; }
