import { supabase } from "../lib/supabase";

export async function guestLogin() {
  return await supabase.auth.signInAnonymously();
}

export async function login(email: string, password: string) {
  console.log("before supabase");

  const result = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  console.log("after supabase", result);

  return result;
}

export async function signup(
  email: string,
  username: string,
  password: string,
) {
  return await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: username,
      },
    },
  });
}

export async function logout() {
  return await supabase.auth.signOut();
}

export async function getUser() {
  return await supabase.auth.getUser();
}
