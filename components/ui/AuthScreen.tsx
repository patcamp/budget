"use client";

import { useState } from "react";
import { signIn, signUp } from "@/components/api/auth";

// Full-page login/register gate. Doesn't need an onAuthed callback:
// page.tsx subscribes to onAuthChange, which fires as soon as
// signIn/signUp establishes a session.

const inputStyle: React.CSSProperties = {
  background: "#080B12",
  border: "1px solid #1E293B",
  borderRadius: 6,
  color: "#F1F5F9",
  fontSize: 13,
  padding: "9px 12px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#64748B",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  display: "block",
  marginBottom: 4,
};

export default function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [payType, setPayType] = useState<"salary" | "hourly">("salary");
  const [salary, setSalary] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [nightDiff, setNightDiff] = useState("");
  const [dayHours, setDayHours] = useState("");
  const [nightHours, setNightHours] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function switchMode(next: "login" | "register") {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }
    if (mode === "register") {
      if (!fullName.trim()) { setError("Name is required."); return; }
      if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
      // All pay fields are optional at registration — refine later in Admin →
      // Paycheck — but anything entered must be a valid non-negative number.
      const num = (raw: string, label: string): { val: number | null; err: string | null } => {
        if (!raw.trim()) return { val: null, err: null };
        const n = parseFloat(raw);
        return isNaN(n) || n < 0 ? { val: null, err: `${label} must be a valid number.` } : { val: n, err: null };
      };
      const fields =
        payType === "salary"
          ? { annual_salary: num(salary, "Annual salary"), hourly_rate: { val: null, err: null }, night_diff_value: { val: null, err: null }, default_day_hours: { val: null, err: null }, default_night_hours: { val: null, err: null } }
          : { annual_salary: { val: null, err: null }, hourly_rate: num(hourlyRate, "Hourly rate"), night_diff_value: num(nightDiff, "Night differential"), default_day_hours: num(dayHours, "Day hours"), default_night_hours: num(nightHours, "Night hours") };
      const firstFieldError = Object.values(fields).find((f) => f.err)?.err;
      if (firstFieldError) { setError(firstFieldError); return; }
      setBusy(true);
      const res = await signUp(email.trim(), password, {
        full_name: fullName.trim(),
        company: company.trim(),
        pay_type: payType,
        annual_salary: fields.annual_salary.val,
        hourly_rate: fields.hourly_rate.val,
        night_diff_value: fields.night_diff_value.val,
        default_day_hours: fields.default_day_hours.val,
        default_night_hours: fields.default_night_hours.val,
      });
      setBusy(false);
      if (res.error) { setError(res.error); return; }
      if (res.needsConfirmation) {
        setNotice("Account created — check your email for a confirmation link, then sign in.");
        setMode("login");
      }
      // If no confirmation is required, onAuthChange in page.tsx takes over.
      return;
    }

    setBusy(true);
    const err = await signIn(email.trim(), password);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#080B12", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#F1F5F9" }}>Budget</div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Pay-period spending tracker</div>
        </div>

        <form onSubmit={handleSubmit} style={{ background: "#0F1825", border: "1px solid #1E293B", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#F1F5F9", marginBottom: 2 }}>
            {mode === "login" ? "Sign in" : "Create your account"}
          </div>

          {mode === "register" && (
            <>
              <div>
                <label style={labelStyle}>Name</label>
                <input type="text" value={fullName} placeholder="Your name" autoComplete="name"
                  onChange={(e) => setFullName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Company (optional)</label>
                <input type="text" value={company} placeholder="Where you work" autoComplete="organization"
                  onChange={(e) => setCompany(e.target.value)} style={inputStyle} />
              </div>
            </>
          )}

          <div>
            <label style={labelStyle}>Email</label>
            <input type="email" value={email} placeholder="you@example.com" autoComplete="email"
              onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Password</label>
            <input type="password" value={password} placeholder={mode === "register" ? "At least 6 characters" : "••••••••"}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
          </div>

          {mode === "register" && (
            <>
              <div>
                <label style={labelStyle}>How are you paid?</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["salary", "hourly"] as const).map((pt) => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => setPayType(pt)}
                      style={{
                        flex: 1,
                        padding: "8px 0",
                        borderRadius: 7,
                        border: `1px solid ${payType === pt ? "#3B82F6" : "#1E293B"}`,
                        background: payType === pt ? "#132038" : "transparent",
                        color: payType === pt ? "#F1F5F9" : "#64748B",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {pt === "salary" ? "Salary" : "Hourly"}
                    </button>
                  ))}
                </div>
              </div>

              {payType === "salary" ? (
                <div>
                  <label style={labelStyle}>Annual Salary (optional)</label>
                  <div style={{ display: "flex", alignItems: "center", background: "#080B12", border: "1px solid #1E293B", borderRadius: 6, overflow: "hidden" }}>
                    <span style={{ padding: "9px 10px", color: "#475569", fontSize: 13, borderRight: "1px solid #1E293B" }}>$</span>
                    <input type="number" step="1" min="0" value={salary} placeholder="60000"
                      onChange={(e) => setSalary(e.target.value)}
                      style={{ flex: 1, background: "transparent", border: "none", color: "#F1F5F9", fontSize: 13, padding: "9px 12px", outline: "none", width: 0 }} />
                  </div>
                  <div style={{ fontSize: 11, color: "#374151", marginTop: 4 }}>Used to set up your first paycheck estimate — adjustable later in Admin.</div>
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={labelStyle}>Hourly Rate</label>
                      <div style={{ display: "flex", alignItems: "center", background: "#080B12", border: "1px solid #1E293B", borderRadius: 6, overflow: "hidden" }}>
                        <span style={{ padding: "9px 10px", color: "#475569", fontSize: 13, borderRight: "1px solid #1E293B" }}>$</span>
                        <input type="number" step="0.01" min="0" value={hourlyRate} placeholder="38.00"
                          onChange={(e) => setHourlyRate(e.target.value)}
                          style={{ flex: 1, background: "transparent", border: "none", color: "#F1F5F9", fontSize: 13, padding: "9px 12px", outline: "none", width: 0 }} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Night Diff ($/hr)</label>
                      <div style={{ display: "flex", alignItems: "center", background: "#080B12", border: "1px solid #1E293B", borderRadius: 6, overflow: "hidden" }}>
                        <span style={{ padding: "9px 10px", color: "#475569", fontSize: 13, borderRight: "1px solid #1E293B" }}>$</span>
                        <input type="number" step="0.01" min="0" value={nightDiff} placeholder="4.50"
                          onChange={(e) => setNightDiff(e.target.value)}
                          style={{ flex: 1, background: "transparent", border: "none", color: "#F1F5F9", fontSize: 13, padding: "9px 12px", outline: "none", width: 0 }} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Day Hrs / Period</label>
                      <input type="number" step="0.25" min="0" value={dayHours} placeholder="60"
                        onChange={(e) => setDayHours(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Night Hrs / Period</label>
                      <input type="number" step="0.25" min="0" value={nightHours} placeholder="24"
                        onChange={(e) => setNightHours(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#374151" }}>
                    All optional — your typical schedule per pay period. A percent-based night differential and everything else can be set later in Admin.
                  </div>
                </>
              )}
            </>
          )}

          {error && (
            <div style={{ padding: "9px 12px", borderRadius: 8, background: "#1A0A0A", border: "1px solid #7F1D1D", fontSize: 12, color: "#F87171" }}>
              {error}
            </div>
          )}
          {notice && (
            <div style={{ padding: "9px 12px", borderRadius: 8, background: "#0D1F14", border: "1px solid #166534", fontSize: 12, color: "#4ADE80" }}>
              {notice}
            </div>
          )}

          <button type="submit" disabled={busy}
            style={{ padding: "11px 20px", background: "#1D4ED8", border: "1px solid #3B82F6", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}>
            {busy ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
          </button>

          <div style={{ textAlign: "center", fontSize: 12, color: "#64748B" }}>
            {mode === "login" ? (
              <>No account?{" "}
                <button type="button" onClick={() => switchMode("register")}
                  style={{ background: "none", border: "none", color: "#3B82F6", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                  Register
                </button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button type="button" onClick={() => switchMode("login")}
                  style={{ background: "none", border: "none", color: "#3B82F6", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                  Sign in
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
