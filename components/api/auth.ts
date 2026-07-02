import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { Profile } from "@/lib/types";

// Re-exported so UI components can type session state without
// importing from @supabase/supabase-js (all Supabase access goes
// through components/api/ per the repo convention).
export type AuthSession = Session;

export interface SignUpInfo {
  full_name: string;
  company: string;
  pay_type: "salary" | "hourly";
  annual_salary: number | null;
  hourly_rate: number | null;
  // Registration only offers a flat $/hr differential; % of base rate
  // can be switched on later in Admin → Paycheck.
  night_diff_value: number | null;
  default_day_hours: number | null;
  default_night_hours: number | null;
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error?.message ?? null;
}

// Returns { needsConfirmation: true } when the Supabase project has
// "Confirm email" enabled — the user exists but has no session until
// they click the link in the confirmation email.
export async function signUp(
  email: string,
  password: string,
  info: SignUpInfo
): Promise<{ error: string | null; needsConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Picked up by the handle_new_user DB trigger (profiles row) and
      // by first-login onboarding (pay fields → paycheck_config).
      data: {
        full_name: info.full_name,
        company: info.company,
        pay_type: info.pay_type,
        annual_salary: info.annual_salary,
        hourly_rate: info.hourly_rate,
        night_diff_value: info.night_diff_value,
        default_day_hours: info.default_day_hours,
        default_night_hours: info.default_night_hours,
      },
    },
  });
  if (error) return { error: error.message, needsConfirmation: false };
  return { error: null, needsConfirmation: !data.session };
}

export async function signOut(): Promise<string | null> {
  const { error } = await supabase.auth.signOut();
  return error?.message ?? null;
}

export async function getSession(): Promise<AuthSession | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Fires on sign-in, sign-out, and token refresh. Returns an
// unsubscribe function for useEffect cleanup.
export function onAuthChange(cb: (session: AuthSession | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

export async function getProfile(): Promise<{ data: Profile | null; error: string | null }> {
  const { data, error } = await supabase.from("profiles").select("*").limit(1).maybeSingle();
  return { data: (data as Profile | null) ?? null, error: error?.message ?? null };
}

export async function updateProfile(
  id: string,
  payload: { full_name?: string | null; company?: string | null }
): Promise<string | null> {
  const { error } = await supabase.from("profiles").update(payload).eq("id", id);
  return error?.message ?? null;
}
