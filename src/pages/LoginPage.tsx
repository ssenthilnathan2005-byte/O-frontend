import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, KeyRound, Loader2, Lock, Mail, Phone, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { auth, forgotPassword, resetPasswordByToken } from "../api";
import { useStore } from "../context/StoreContext";
import { useRouter } from "../router/RouterContext";

const HIDDEN_ADMIN_CODE       = "Founder@db";
const HIDDEN_ADMIN_NAME       = "Founder@db";
const HIDDEN_ADMIN_PASSWORD   = "Senthil@founder.db";
const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || "";

declare global {
  interface Window {
    google?: {
      accounts: { id: {
        initialize: (c: object) => void;
        renderButton: (el: HTMLElement, c: object) => void;
        prompt: (listener?: (notification: {
          isNotDisplayed?: () => boolean;
          isSkippedMoment?: () => boolean;
          isDismissedMoment?: () => boolean;
          getNotDisplayedReason?: () => string;
          getSkippedReason?: () => string;
          getDismissedReason?: () => string;
        }) => void) => void;
        cancel: () => void;
      }};
    };
  }
}

type Screen =
  | "patient-form"   // signup or login form
  | "forgot-email"   // forgot password: request reset email
  | "forgot-link-sent" // forgot password: email sent acknowledgement
  | "forgot-new-password"; // forgot password: set new password

interface LoginPageProps {
  initialTab?: "patient" | "doctor";
  initialPatientMode?: "login" | "signup";
}

function loadGoogleScript(): Promise<void> {
  return new Promise((resolve) => {
    if (window.google) { resolve(); return; }
    const existing = document.getElementById("google-gsi-script");
    if (existing) { existing.addEventListener("load", () => resolve(), { once: true }); return; }
    const s = document.createElement("script");
    s.id = "google-gsi-script"; s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true; s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

export default function LoginPage({
  initialTab = "patient",
  initialPatientMode = "signup",
}: LoginPageProps) {
  const { login } = useStore();
  const { navigate } = useRouter();

  const [activeTab, setActiveTab] = useState<"patient" | "doctor">(initialTab);
  const [patientMode, setPatientMode] = useState<"login" | "signup">(initialPatientMode);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [name, setName]             = useState("");
  const [identifier, setIdentifier] = useState(""); // email OR phone
  const [password, setPassword]     = useState("");

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [screen, setScreen]           = useState<Screen>("patient-form");

  const [doctorCode, setDoctorCode] = useState("");
  const [doctorPass, setDoctorPass] = useState("");
  const [loading, setLoading]       = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  }
  function isValidPhone(value: string): boolean {
    return /^[6-9]\d{9}$/.test(value.replace(/\s/g, ""));
  }
  function identifierType(value: string): "email" | "phone" | "unknown" {
    const v = value.trim();
    if (isValidEmail(v)) return "email";
    if (isValidPhone(v)) return "phone";
    return "unknown";
  }


  const googleBtnRef = useRef<HTMLDivElement>(null);
  const googleReady  = useRef(false);
  const oneTapPromptedRef = useRef(false);

  useEffect(() => {
    setActiveTab(initialTab);
    setPatientMode(initialPatientMode);
    setScreen("patient-form");
  }, [initialTab, initialPatientMode]);

  useEffect(() => {
    if (window.location.pathname !== "/login") return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    const patientModeParam = params.get("patientMode");
    if (tab === "doctor") setActiveTab("doctor");
    if (patientModeParam === "login" || patientModeParam === "signup") {
      setPatientMode(patientModeParam);
    }
  }, []);

  useEffect(() => {
    if (window.location.pathname !== "/login" || screen !== "patient-form") return;
    const url = new URL(window.location.href);
    url.pathname = "/login";

    if (activeTab === "patient" && patientMode === "signup") {
      url.searchParams.delete("tab");
      url.searchParams.delete("patientMode");
    } else {
      url.searchParams.set("tab", activeTab);
      url.searchParams.set("patientMode", patientMode);
    }

    window.history.replaceState({}, "", url.toString());
  }, [activeTab, patientMode, screen]);

  // Handle reset links opened from email: /login?mode=reset&token=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const mode = params.get("mode");
    if (token && (!mode || mode === "reset")) {
      setResetToken(token);
      setActiveTab("patient");
      setPatientMode("login");
      setScreen("forgot-new-password");
    }
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────

  // ── Google button ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || screen !== "patient-form" || activeTab !== "patient") return;
    async function setup() {
      await loadGoogleScript();
      if (!googleReady.current) {
        window.google!.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredential,
          auto_select: false, cancel_on_tap_outside: true,
        });
        googleReady.current = true;
      }
      requestAnimationFrame(() => {
        if (googleBtnRef.current && window.google) {
          googleBtnRef.current.innerHTML = "";
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            type: "standard", theme: "outline", size: "large",
            text: "continue_with", shape: "pill", logo_alignment: "left",
            width: Math.min(googleBtnRef.current.offsetWidth || 320, 400),
          });
        }
      });

      // Trigger Google One Tap prompt once per page load for quick cloud sign-in.
      if (!oneTapPromptedRef.current && window.google) {
        oneTapPromptedRef.current = true;
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed?.()) {
            console.info("[google one-tap] not displayed:", notification.getNotDisplayedReason?.());
          } else if (notification.isSkippedMoment?.()) {
            console.info("[google one-tap] skipped:", notification.getSkippedReason?.());
          } else if (notification.isDismissedMoment?.()) {
            console.info("[google one-tap] dismissed:", notification.getDismissedReason?.());
          }
        });
      }
    }
    setup().catch(console.error);
  }, [activeTab, patientMode, screen]);

  // ── Google credential callback ──────────────────────────────────────────────
  async function handleGoogleCredential(response: { credential: string }) {
    setGoogleLoading(true);
    try {
      const result = await auth.googleLogin(response.credential);
      if (result.token && result.user) {
        login(result.user, result.token);
        toast.success(`Welcome, ${(result.user as any).name || ""}!`);
        navigate({ path: "/patient/hospitals" });
      }
    } catch (err: any) {
      toast.error(err.message || "Google sign-in failed");
    } finally { setGoogleLoading(false); }
  }

  // ── Signup ───────────────────────────────────────────────────────────────────
  async function handleSignupSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = identifier.trim();
    if (!name.trim() || !password || !id) {
      toast.error("Please fill all fields"); return;
    }
    const type = identifierType(id);
    if (type === "unknown") {
      toast.error("Please enter a valid email address or 10-digit phone number"); return;
    }
    setLoading(true);
    try {
      const res = type === "email"
        ? await auth.patientSignup(name.trim(), password, id.toLowerCase(), undefined)
        : await auth.patientSignup(name.trim(), password, undefined, id);
      if (res.token && res.user) {
        login(res.user, res.token);
        toast.success("Account created! Welcome to Doctor Booked.");
        navigate({ path: "/patient/hospitals" });
        return;
      }
    } catch (err: any) { toast.error(err.message || "Registration failed"); }
    finally { setLoading(false); }
  }

  // ── Login ────────────────────────────────────────────────────────────────────
  function isAdminIdentifier(value: string) {
    const normalized = value.trim().toLowerCase();
    return normalized === HIDDEN_ADMIN_CODE.toLowerCase() || normalized === HIDDEN_ADMIN_NAME.toLowerCase();
  }

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = identifier.trim();
    const pw = password;
    if (!id || !pw) { toast.error("Please fill all fields"); return; }

    // Hidden admin
    if (isAdminIdentifier(id)) {
      setLoading(true);
      try {
        const { token, user } = await auth.adminLogin(HIDDEN_ADMIN_CODE, pw);
        login(user, token); navigate({ path: "/admin" });
      } catch (err: any) { toast.error(err.message || "Admin login failed"); }
      finally { setLoading(false); }
      return;
    }

    const type = identifierType(id);
    if (type === "unknown") {
      toast.error("Please enter a valid email address or 10-digit phone number"); return;
    }

    setLoading(true);
    try {
      const res = await auth.patientLogin(type === "email" ? id.toLowerCase() : id, pw);
      if (res.token && res.user) {
        login(res.user, res.token);
        navigate({ path: "/patient/hospitals" });
        return;
      }
    } catch (err: any) { toast.error(err.message || "Login failed"); }
    finally { setLoading(false); }
  }

  async function handleForgotRequest(e: React.FormEvent) {
    e.preventDefault();
    const em = forgotEmail.trim().toLowerCase();
    if (!em) { toast.error("Enter your email"); return; }
    if (!isValidEmail(em)) { toast.error("Please enter a valid email address"); return; }

    setLoading(true);
    try {
      const res = await forgotPassword(em);
      toast.success(res.message || "If this email exists, a reset link has been sent.");
      setScreen("forgot-link-sent");
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetToken) {
      toast.error("Invalid or expired reset link. Request a new one.");
      setScreen("forgot-email");
      return;
    }
    if (!newPassword || !confirmPassword) {
      toast.error("Please fill all fields");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await resetPasswordByToken(resetToken, newPassword);
      toast.success(res.message || "Password reset successful. Please log in.");
      setScreen("patient-form");
      setPatientMode("login");
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setResetToken("");
      window.history.replaceState({}, "", "/login");
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  }



  // ── Doctor login ──────────────────────────────────────────────────────────────
  async function handleDoctorLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!doctorCode || !doctorPass) { toast.error("Please fill all fields"); return; }
    setLoading(true);
    try {
      const { token, user } = await auth.doctorLogin(doctorCode.trim(), doctorPass.trim());
      login(user, token); navigate({ path: "/doctor" });
    } catch (err: any) { toast.error(err.message || "Login failed"); }
    finally { setLoading(false); }
  }

  function switchMode(mode: "login" | "signup") {
    setPatientMode(mode); setScreen("patient-form");
    setName(""); setIdentifier(""); setPassword("");
    setResetToken("");
    setNewPassword(""); setConfirmPassword("");
  }

  function handleBackFromLogin() {
    navigate({ path: "/" });
  }

  // ── Shared Google section ─────────────────────────────────────────────────────
  const googleSection = GOOGLE_CLIENT_ID && screen === "patient-form" ? (
    <div className="space-y-3 mb-4">
      {googleLoading
        ? <div className="flex justify-center items-center gap-2 text-sm text-gray-500 py-2.5">
            <Loader2 className="w-4 h-4 animate-spin text-teal-500" /> Signing in with Google…
          </div>
        : <div ref={googleBtnRef} className="w-full flex justify-center min-h-[44px]" />
      }
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400 font-medium">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
    </div>
  ) : null;


  // ── Forgot Password: Email Screen ────────────────────────────────────────────
  if (screen === "forgot-email") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-7 h-7 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Forgot Password</h2>
            <p className="text-sm text-gray-500 mt-2">Enter your registered email to receive a reset link.</p>
          </div>
          <form onSubmit={handleForgotRequest} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <Input
                  type="email"
                  className="pl-9"
                  placeholder="you@example.com"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <Button type="submit" className="w-full bg-teal-500 hover:bg-teal-600 rounded-full h-11" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending email…</> : "Send Reset Link"}
            </Button>
            <button type="button" className="w-full text-xs text-gray-400 hover:text-gray-600 text-center" onClick={() => setScreen("patient-form")}>← Back to Login</button>
          </form>
        </div>
      </div>
    );
  }

  // ── Forgot Password: Link Sent Screen ───────────────────────────────────────
  if (screen === "forgot-link-sent") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-7 h-7 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Check Your Email</h2>
            <p className="text-sm text-gray-500 mt-2">If an account exists for <span className="font-semibold text-gray-700">{forgotEmail}</span>, we have sent a password reset link.</p>
          </div>
          <div className="space-y-3">
            <Button type="button" className="w-full bg-teal-500 hover:bg-teal-600 rounded-full h-11" onClick={() => setScreen("patient-form")}>Back to Login</Button>
            <button type="button" className="w-full text-xs text-gray-400 hover:text-gray-600 text-center" onClick={() => setScreen("forgot-email")}>Use another email</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Forgot Password: New Password Screen ────────────────────────────────────
  if (screen === "forgot-new-password") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-7 h-7 text-teal-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Set New Password</h2>
            <p className="text-sm text-gray-500 mt-2">Create a new password for your account.</p>
          </div>
          <form onSubmit={handleForgotSetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <Input
                  type="password"
                  className="pl-9"
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <Input
                  type="password"
                  className="pl-9"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" className="w-full bg-teal-500 hover:bg-teal-600 rounded-full h-11" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating…</> : "Update Password"}
            </Button>
            <button
              type="button"
              className="w-full text-xs text-gray-400 hover:text-gray-600 text-center"
              onClick={() => { setScreen("forgot-email"); setNewPassword(""); setConfirmPassword(""); }}
            >
              ← Back
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Main Screen ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleBackFromLogin}
            className="flex items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-gray-50"
            aria-label="Go back"
          >
            <img src="/assets/Logo.jpg"
              alt="Doctor Booked" className="w-8 h-8 rounded-full object-cover shrink-0"
              onError={e => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%2314b8a6'/%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='18' font-family='sans-serif'%3EDB%3C/text%3E%3C/svg%3E"; }} />
            <span className="text-base">
              <span className="font-bold text-gray-900">Doctor</span>
              <span className="font-bold text-teal-500"> Booked</span>
            </span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-4xl">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "patient" | "doctor")} className="w-full">
            {/* moved tab triggers inside each tab content to avoid duplicate top tab */}

            {/* ── Patient tab ── */}
            <TabsContent value="patient">
              <div className="max-w-xs mx-auto mb-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="patient">Patient</TabsTrigger>
                  <TabsTrigger value="doctor">Doctor</TabsTrigger>
                </TabsList>
              </div>
              <div className="flex flex-col sm:flex-row max-w-3xl mx-auto rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                <div className="hidden sm:flex sm:w-2/5 bg-gradient-to-b from-teal-200 to-teal-500 items-end pb-10 px-8 min-h-[280px]">
                  <div>
                    <h2 className="text-2xl font-bold text-white leading-tight mb-2">Your Health,<br />Prioritized.</h2>
                    <p className="text-teal-50 text-sm leading-relaxed">Book appointments, track your token, and skip the waiting room stress.</p>
                  </div>
                </div>
                <div className="flex-1 bg-white p-6 sm:p-8">
                  <div className="mb-5 hidden sm:block">
                    <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mb-4">
                      <Activity className="w-6 h-6 text-teal-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Patient Portal</h3>
                    <p className="text-gray-500 text-sm mt-1">{patientMode === "signup" ? "Create your account" : "Welcome back"}</p>
                  </div>

                  {googleSection}

                  {patientMode === "signup" ? (
                    <form onSubmit={handleSignupSubmit} className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>Full Name</Label>
                        <div className="relative"><User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                          <Input className="pl-9" placeholder="Your full name" value={name} onChange={e => setName(e.target.value)} /></div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Email or Phone Number</Label>
                        <div className="relative">
                          {isValidPhone(identifier.trim())
                            ? <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            : <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                          }
                          <Input
                            type="text"
                            inputMode={isValidPhone(identifier.trim().slice(0,1)) ? "numeric" : "email"}
                            className="pl-9"
                            placeholder="Email or 10-digit phone number"
                            value={identifier}
                            onChange={e => setIdentifier(e.target.value)}
                            maxLength={50}
                          />
                        </div>
                        <p className="text-xs text-gray-400">
                          {isValidPhone(identifier.trim())
                            ? "Signing up with phone number"
                            : "Gmail address or Indian mobile number (e.g. 9876543210)"}
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Password</Label>
                        <div className="relative"><Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                          <Input type="password" className="pl-9" placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} /></div>
                      </div>
                      <div className="flex items-start gap-2 mt-1">
                        <input
                          type="checkbox"
                          id="terms"
                          checked={agreedToTerms}
                          onChange={e => setAgreedToTerms(e.target.checked)}
                          className="mt-0.5 accent-teal-500"
                        />
                        <label htmlFor="terms" className="text-xs text-gray-500 leading-relaxed">
                          I agree to the{" "}
                          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline font-medium">
                            Terms & Conditions
                          </a>
                          {" "}of Doctor Booked
                        </label>
                      </div>
                      <Button type="submit" className="w-full bg-teal-500 hover:bg-teal-600 rounded-full h-11 mt-1" disabled={loading || !agreedToTerms}>
                        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account…</> : "Sign Up"}
                      </Button>
                      <p className="text-xs text-center text-gray-500">Already have an account?{" "}
                        <button type="button" className="text-teal-600 hover:underline font-medium" onClick={() => switchMode("login")}>Log in</button></p>
                    </form>
                  ) : (
                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label>Email or Phone Number</Label>
                        <div className="relative">
                          {isValidPhone(identifier.trim())
                            ? <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            : <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                          }
                          <Input
                            type="text"
                            inputMode={isValidPhone(identifier.trim().slice(0,1)) ? "numeric" : "email"}
                            className="pl-9"
                            placeholder="Email or 10-digit phone number"
                            value={identifier}
                            onChange={e => setIdentifier(e.target.value)}
                            maxLength={50}
                          />
                        </div>
                        <p className="text-xs text-gray-400">Enter your registered email or phone number</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Password</Label>
                        <div className="relative"><Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                          <Input type="password" className="pl-9" placeholder="Your password" value={password} onChange={e => setPassword(e.target.value)} /></div>
                      </div>
                      <Button type="submit" className="w-full bg-teal-500 hover:bg-teal-600 rounded-full h-11" disabled={loading}>
                        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Logging in…</> : "Login"}
                      </Button>
                      <p className="text-xs text-center text-gray-500">Don't have an account?{" "}
                        <button type="button" className="text-teal-600 hover:underline font-medium" onClick={() => switchMode("signup")}>Sign up</button></p>
                      <p className="text-xs text-center text-gray-500 mt-1">
                        <button type="button" className="text-gray-400 hover:text-teal-600 hover:underline" onClick={() => setScreen("forgot-email")}>Forgot password?</button>
                      </p>
                    </form>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ── Doctor tab ── */}
            <TabsContent value="doctor">
              <div className="max-w-xs mx-auto mb-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="patient">Patient</TabsTrigger>
                  <TabsTrigger value="doctor">Doctor</TabsTrigger>
                </TabsList>
              </div>
              <div className="max-w-sm mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
                <div className="flex flex-col items-center mb-6">
                  <div className="w-16 h-16 rounded-full overflow-hidden mb-4">
                    <img src="/assets/Logo.jpg"
                      alt="Doctor Booked" className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%2314b8a6'/%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='white' font-size='18' font-family='sans-serif'%3EDB%3C/text%3E%3C/svg%3E"; }} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Doctor Login</h3>
                  <p className="text-gray-500 text-sm mt-1 text-center">Enter your assigned login credentials</p>
                </div>
                <form onSubmit={handleDoctorLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Doctor Login Code</Label>
                    <div className="relative"><KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <Input className="pl-9 font-mono tracking-widest" placeholder="Enter your doctor code" value={doctorCode} onChange={e => setDoctorCode(e.target.value)} /></div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Password</Label>
                    <div className="relative"><Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                      <Input type="password" className="pl-9" placeholder="Enter your password" value={doctorPass} onChange={e => setDoctorPass(e.target.value)} /></div>
                  </div>
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 rounded-full h-11" disabled={loading}>
                    {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</> : "Access Dashboard"}
                  </Button>
                </form>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
