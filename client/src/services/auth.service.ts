import { supabase } from "../lib/supabase";
export const guestLogin = () => supabase.auth.signInAnonymously();
export const login = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });
export const signup = (email: string, username: string, password: string) =>
  supabase.auth.signUp({ email, password, options: { data: { username } } });
export const logout = () => supabase.auth.signOut();
export const getUser = () => supabase.auth.getUser();
