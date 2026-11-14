import { getToken } from "@/api";
import { useStore } from "@/context/StoreContext";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserCog, Loader2, Save, CheckCircle2, MapPin, Bell, ExternalLink, Languages, Copy } from "lucide-react";
import { patients } from "../../api";
import { useRouter } from "../../router/RouterContext";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { enablePushNotifications } from "../../lib/push";
import { Switch } from "@/components/ui/switch";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { KeyRound, Info, Eye, EyeOff } from "lucide-react";
import { setPatientPassword, changePatientPassword } from "../../api";
import FamilyMembersSection from "@/components/FamilyMembersSection";

type PermStatus = "granted" | "denied" | "prompt" | "gps-off" | "unknown";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"];

export default function ProfilePage() {
  const { navigate, replace } = useRouter();
  const { updateUser } = useStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [wasComplete, setWasComplete] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [yearOfBirth, setYearOfBirth] = useState("");
  const [legacyAge, setLegacyAge] = useState("");
  const [area, setArea] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [gender, setGender] = useState("");
  const [uhid, setUhid] = useState("");
  const [abhaId, setAbhaId] = useState("");
  const [abhaOtpSent, setAbhaOtpSent] = useState(false);
  const [abhaOtp, setAbhaOtp] = useState("");
  const [abhaLoading, setAbhaLoading] = useState(false);
  const [abhaTxnId, setAbhaTxnId] = useState("");
  const [uhidCopied, setUhidCopied] = useState(false);
  const [hasPassword, setHasPassword] = useState(true);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwInfoOpen, setPwInfoOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [savedPwDisplay, setSavedPwDisplay] = useState<string>(() => { try { return sessionStorage.getItem("_dbpw") || ""; } catch { return ""; } });
  const [savedNote, setSavedNote] = useState(false);
  const pwEditing = !hasPassword || pwOpen;
  const [locStatus, setLocStatus] = useState<PermStatus>("unknown");
  const [notifStatus, setNotifStatus] = useState<PermStatus>("unknown");

  function isGpsOffError(err: any): boolean {
    const msg = String(err?.message || "");
    const code = String(err?.code || "");
    return (
      code === "OS-PLUG-GLOC-0007" ||
      code === "OS-PLUG-GLOC-0017" ||
      /location services?.*(not enabled|disabled)/i.test(msg) ||
      /network and location turned off/i.test(msg) ||
      msg.includes("kCLErrorDomain") ||
      err?.code === 2
    );
  }

  async function refreshPermissionStatuses() {
    try {
      if (!Capacitor.isNativePlatform()) {
        if (navigator.permissions?.query) {
          const p = await navigator.permissions.query({ name: "geolocation" as PermissionName });
          setLocStatus(p.state === "granted" ? "granted" : p.state === "denied" ? "denied" : "prompt");
        } else {
          setLocStatus("prompt");
        }
      } else {
        const res = await Geolocation.checkPermissions();
        const status = res.location || res.coarseLocation;
        if (status === "granted") {
          setLocStatus("granted");
          try {
            await Geolocation.getCurrentPosition({ timeout: 5000, maximumAge: 60000 });
          } catch (posErr) {
            if (isGpsOffError(posErr)) setLocStatus("gps-off");
          }
        } else {
          setLocStatus(status === "denied" ? "denied" : "prompt");
        }
      }
    } catch {
      setLocStatus("unknown");
    }

    try {
      if (Capacitor.isNativePlatform()) {
        const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
        const res = await FirebaseMessaging.checkPermissions();
        setNotifStatus(res.receive === "granted" ? "granted" : res.receive === "denied" ? "denied" : "prompt");
      } else if (typeof Notification !== "undefined") {
        const p = Notification.permission;
        setNotifStatus(p === "granted" ? "granted" : p === "denied" ? "denied" : "prompt");
      }
    } catch {
      setNotifStatus("unknown");
    }
  }

  useEffect(() => {
    refreshPermissionStatuses();
    if (!Capacitor.isNativePlatform()) {
      const onVisible = () => { if (document.visibilityState === "visible") refreshPermissionStatuses(); };
      const onFocus = () => { refreshPermissionStatuses(); };
      window.addEventListener("focus", onFocus);
      document.addEventListener("visibilitychange", onVisible);
      const watched: PermissionStatus[] = [];
      let gone = false;
      for (const name of ["geolocation", "notifications"]) {
        navigator.permissions?.query({ name: name as PermissionName }).then((p) => {
          if (gone) return;
          p.onchange = () => { refreshPermissionStatuses(); };
          watched.push(p);
        }).catch(() => {});
      }
      return () => {
        gone = true;
        window.removeEventListener("focus", onFocus);
        document.removeEventListener("visibilitychange", onVisible);
        watched.forEach((p) => { p.onchange = null; });
      };
    }
    let listenerHandle: { remove: () => void } | null = null;
    let cancelled = false;
    (async () => {
      const { App: CapApp } = await import("@capacitor/app");
      const handle = await CapApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) refreshPermissionStatuses();
      });
      if (cancelled) handle.remove(); else listenerHandle = handle;
    })();
    return () => { cancelled = true; listenerHandle?.remove(); };
  }, []);

  async function openAppSettings(option: "ApplicationDetails" | "AppNotification" | "Location") {
    if (!Capacitor.isNativePlatform()) {
      if (option === "Location") {
        toast.error("Your phone's location (GPS) seems to be off. Turn it on in your phone's quick settings, then reload this page.", { duration: 6000 });
      } else if (option === "AppNotification") {
        toast.error("Tap the lock/info icon next to the address bar, then allow Notifications for this site.", { duration: 6000 });
      } else {
        toast.error("Tap the lock/info icon next to the address bar, then allow Location for this site.", { duration: 6000 });
      }
      return;
    }
    const { NativeSettings, AndroidSettings } = await import("capacitor-native-settings");
    await NativeSettings.openAndroid({ option: AndroidSettings[option] }).catch(() => {});
  }

  async function handleLocationClick() {
    if (locStatus === "denied") {
      await openAppSettings("ApplicationDetails");
      return;
    }
    if (locStatus === "gps-off") {
      await openAppSettings("Location");
      return;
    }
    try {
      if (!Capacitor.isNativePlatform()) {
        await new Promise<void>((resolve) => {
          if (!navigator.geolocation) { resolve(); return; }
          navigator.geolocation.getCurrentPosition(() => resolve(), () => resolve(), { timeout: 10000 });
        });
        await refreshPermissionStatuses();
        return;
      }
      const res = await Geolocation.requestPermissions();
      const status = res.location || res.coarseLocation;
      setLocStatus(status === "granted" ? "granted" : status === "denied" ? "denied" : "prompt");
      if (status === "granted") toast.success("Location access enabled");
      else if (status === "denied") toast.error("Location permission was denied");
    } catch (err: any) {
      toast.error(err?.message ? `Could not update location permission: ${err.message}` : "Could not update location permission");
    }
  }

  async function handleNotificationClick() {
    if (notifStatus === "denied") {
      await openAppSettings("AppNotification");
      return;
    }
    try {
      const token = await enablePushNotifications();
      if (token) {
        setNotifStatus("granted");
        toast.success("Notifications enabled");
      } else {
        toast.error("Could not enable notifications");
        await refreshPermissionStatuses();
      }
    } catch (err: any) {
      toast.error(err?.message ? `Could not enable notifications: ${err.message}` : "Could not enable notifications");
    }
  }

  // Switches always reflect the REAL current permission state (set via
  // refreshPermissionStatuses), not just whatever the user last tapped.
  // Turning "on" runs the same request/settings-redirect flow as before.
  // Turning "off" isn't something an app can do to a granted OS permission
  // directly, so we send the user to Settings to do it themselves; the
  // switch will snap back to reflect whatever they actually chose there.
  async function handleLocationToggle() {
    if (locStatus === "granted") {
      await openAppSettings("ApplicationDetails");
      return;
    }
    await handleLocationClick();
  }

  async function handleNotificationToggle() {
    if (notifStatus === "granted") {
      await openAppSettings("AppNotification");
      return;
    }
    await handleNotificationClick();
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await patients.getProfile();
        if (cancelled) return;
        setName(data.name || "");
        setPhone(String(data.phone || "").replace(/\D/g, "").slice(-10));
        setUhid(data.uhid || "");
        setHasPassword((data as any).hasPassword !== false);
        setYearOfBirth(data.yearOfBirth || "");
        setArea(data.area || "");
        setBloodGroup(data.bloodGroup || "");
        setGender(data.gender || "");
        setLegacyAge(data.yearOfBirth ? "" : (data.age || ""));
        setWasComplete(data.isComplete);
        if (sessionStorage.getItem("db_after_profile") && (!data.area || !data.bloodGroup || !data.gender)) toast.info("Please add your Area, Blood Group and Gender to continue your booking.");
      } catch (err: any) {
        toast.error(err.message || "Could not load your profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function copyUhid() {
    try {
      await navigator.clipboard.writeText(uhid);
      setUhidCopied(true);
      setTimeout(() => setUhidCopied(false), 1500);
    } catch {
      toast.error("Could not copy. Your UHID is " + uhid);
    }
  }

  async function handlePasswordSubmit() {
    if (hasPassword && !currentPw) { toast.error("Enter your current password"); return; }
    if (newPw.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setPwSaving(true);
    try {
      if (hasPassword) {
        await changePatientPassword(currentPw, newPw);
        toast.success("Password changed");
      } else {
        await setPatientPassword(newPw);
        setHasPassword(true);
        toast.success("Password set. You can now log in with your UHID and password.");
      }
      try { sessionStorage.setItem("_dbpw", newPw); setSavedPwDisplay(newPw); } catch {}
      setCurrentPw(""); setNewPw(""); setShowPw(false); setPwOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Could not update password");
    } finally {
      setPwSaving(false);
    }
  }

  function isValidPhone(value: string): boolean {
    return /^\d{10}$/.test(value.trim());
  }

  async function handleSave() {
    if (!name.trim() || !phone.trim() || !yearOfBirth.trim()) {
      toast.error("Please fill in your name, phone number, and year of birth");
      return;
    }
    if (!isValidPhone(phone)) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }
    if (!area.trim()) { toast.error("Please enter your area / locality"); return; }
    if (!bloodGroup) { toast.error("Please select your blood group"); return; }
    if (!gender) { toast.error("Please select your gender"); return; }
    const yearNum = Number(yearOfBirth);
    if (!/^\d{4}$/.test(yearOfBirth.trim()) || yearNum < new Date().getFullYear() - 120 || yearNum > new Date().getFullYear()) {
      toast.error("Please enter a valid 4-digit year of birth");
      return;
    }

    setSaving(true);
    try {
      await patients.updateProfile({ name: name.trim(), phone: phone.trim(), yearOfBirth: yearOfBirth.trim(), area: area.trim(), bloodGroup, gender });
      toast.success("Profile saved");
      updateUser({ name: name.trim(), phone: phone.trim(), gender } as any);
      setWasComplete(true);
      let back: any = { path: "/" };
      try { const raw = sessionStorage.getItem("db_after_profile"); if (raw) { back = JSON.parse(raw); sessionStorage.removeItem("db_after_profile"); } } catch {}
      replace(back);
    } catch (err: any) {
      toast.error(err.message || "Could not save your profile");
    } finally {
      setSaving(false);
    }
  }

  const thisYear = new Date().getFullYear();
  const yobNum = Number(yearOfBirth);
  const yobValid = /^\d{4}$/.test(yearOfBirth) && yobNum >= thisYear - 120 && yobNum <= thisYear;
  const displayAge = yobValid ? String(thisYear - yobNum) : (yearOfBirth ? "" : legacyAge);

  if (loading) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500 mx-auto" />
      </div>
    );
  }

  async function handleAbhaSendOtp() {
    setAbhaLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}/abdm/abha/generate-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ mobile: phone }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to send OTP"); return; }
      setAbhaTxnId(data.txnId);
      setAbhaOtpSent(true);
      toast.success("OTP sent to your mobile");
    } catch { toast.error("Network error"); }
    finally { setAbhaLoading(false); }
  }

  async function handleAbhaVerifyOtp() {
    setAbhaLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}/abdm/abha/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ txnId: abhaTxnId, otp: abhaOtp }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Invalid OTP"); return; }
      setAbhaId(data.abhaId);
      setAbhaOtpSent(false);
      setAbhaOtp("");
      toast.success("ABHA linked successfully!");
    } catch { toast.error("Network error"); }
    finally { setAbhaLoading(false); }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <div className="text-center pb-4">
        <div className="w-14 h-14 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-3">
          <UserCog className="w-7 h-7 text-teal-500" />
        </div>
        <h1 className="font-bold text-gray-900 text-xl">My Profile</h1>
        <p className="text-sm text-gray-400 mt-1">
          {wasComplete
            ? "These details are used to auto-fill your bookings."
            : "Fill this in once — we'll auto-fill it for future bookings."}
        </p>
      </div>

      <div className="space-y-3 bg-white border border-gray-200 rounded-2xl p-4">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Name <span className="text-red-500">*</span></label>
          <input
            type="text"
            placeholder="Enter your full name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
          />
          <p className="text-[11px] text-gray-400 mt-1">Enter your name as on your Aadhaar / ABHA card.</p>
        </div>
        {uhid && (
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">UHID (Unique Health ID)</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={uhid}
                readOnly
                tabIndex={-1}
                className="w-full border border-gray-200 bg-gray-50 text-gray-800 font-semibold tracking-wide rounded-lg px-3 py-2 text-sm cursor-default focus:outline-none"
              />
              <button
                type="button"
                onClick={copyUhid}
                aria-label="Copy UHID"
                className="shrink-0 border border-gray-200 rounded-lg p-2 text-gray-500 hover:bg-gray-50"
              >
                {uhidCopied ? <CheckCircle2 className="w-4 h-4 text-teal-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
        {/* Password - always visible, directly below UHID */}
        <div className="mt-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-teal-600" />
            <span className="text-xs font-medium text-gray-600">Password</span>
            <button
              type="button"
              aria-label="Password info"
              onClick={() => setPwInfoOpen(v => !v)}
              className="w-5 h-5 rounded-full border border-gray-300 text-gray-500 hover:bg-gray-50 flex items-center justify-center"
            >
              <Info className="w-3 h-3" />
            </button>
          </div>
          {pwInfoOpen && (
            <p className="mt-2 text-xs text-teal-700 bg-teal-50 rounded-lg px-3 py-2">
              You can login with your UHID and password.
            </p>
          )}

          {hasPassword && pwOpen && (
            <div className="relative mt-2">
<input type="password" placeholder="Current password" value={currentPw}
              onChange={e => setCurrentPw(e.target.value)} autoComplete="current-password"
              className="w-full border border-gray-200 rounded-lg pl-3 pr-20 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />

</div>
          )}

          <div className="relative mt-2">
            <input
              type={!pwEditing && showPw && savedPwDisplay ? "text" : "password"}
              value={pwEditing ? newPw : (showPw && savedPwDisplay ? savedPwDisplay : "••••••••")}
              readOnly={!pwEditing}
              onChange={e => setNewPw(e.target.value)}
              placeholder={hasPassword ? "New password (min 6 characters)" : "Create a password (min 6 characters)"}
              autoComplete="new-password"
              className={"w-full border border-gray-200 rounded-lg pl-3 pr-20 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 " + (pwEditing ? "" : "bg-gray-50 text-gray-500")}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              aria-label={showPw ? "Hide password" : "Show password"}
              className={!pwEditing ? "absolute right-3 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1 whitespace-nowrap shrink-0 text-xs font-medium text-gray-600 hover:text-gray-800" : "hidden"}
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showPw ? "Hide" : "Show"}
            </button>
          </div>

          {!pwEditing && showPw && !savedPwDisplay && (
            <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              Password not available to display. Change your password once to enable Show.
            </p>
          )}
          {pwEditing && (
            <div className="flex gap-2 mt-3">
              <button type="button" onClick={handlePasswordSubmit} disabled={pwSaving}
                className="flex-1 h-10 bg-teal-500 hover:bg-teal-600 disabled:opacity-60 text-white rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                {pwSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {hasPassword ? "Save New Password" : "Set Password"}
              </button>
              {hasPassword && (
                <button type="button"
                  onClick={() => { setPwOpen(false); try { sessionStorage.setItem("_dbpw", newPw); setSavedPwDisplay(newPw); } catch {}
      setCurrentPw(""); setNewPw(""); setShowPw(false); }}
                  className="h-10 px-4 border border-gray-200 rounded-full text-sm text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
              )}
            </div>
          )}

          {hasPassword && !pwOpen && (
            <button type="button" onClick={() => { setSavedNote(false); setPwOpen(true); }}
              className="w-full h-10 mt-3 border border-teal-500 text-teal-600 hover:bg-teal-50 rounded-full text-sm font-semibold transition-colors">
              Change Password
            </button>
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Phone Number <span className="text-red-500">*</span></label>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="Enter 10-digit phone number"
            value={phone}
            onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Area / Locality <span className="text-red-500">*</span></label>
          <input
            type="text"
            placeholder="e.g. Anna Nagar (area name only)"
            value={area}
            onChange={e => setArea(e.target.value)}
            maxLength={60}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Blood Group <span className="text-red-500">*</span></label>
          <select
            value={bloodGroup}
            onChange={e => setBloodGroup(e.target.value)}
            className="w-full border border-gray-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
          >
            <option value="">Select blood group</option>
            {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Gender <span className="text-red-500">*</span></label>
          <select
            value={gender}
            onChange={e => setGender(e.target.value)}
            className="w-full border border-gray-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
          >
            <option value="">Select gender</option>
            {["Male", "Female", "Other"].map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Year of Birth <span className="text-red-500">*</span></label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 1998"
              value={yearOfBirth}
              onChange={e => setYearOfBirth(e.target.value.replace(/\D/g, "").slice(0, 4))}
              maxLength={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Your Age</label>
            <input
              type="text"
              value={displayAge}
              readOnly
              tabIndex={-1}
              placeholder="Auto"
              className="w-full border border-gray-200 bg-gray-50 text-gray-600 rounded-lg px-3 py-2 text-sm cursor-not-allowed focus:outline-none"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 mt-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-60 text-white rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
          ) : wasComplete ? (
            <><CheckCircle2 className="w-4 h-4" /> Update Profile</>
          ) : (
            <><Save className="w-4 h-4" /> Save Profile</>
          )}
        </button>
      </div>

      <FamilyMembersSection />

      {/* Permissions */}
      <div className="space-y-3 bg-white border border-gray-200 rounded-2xl p-4 mt-4">
        <h2 className="text-sm font-semibold text-gray-900">App Permissions</h2>

        <div className="flex items-center justify-between gap-3 py-1">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-teal-50 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-teal-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">Location</p>
              <p className="text-xs text-gray-400">
                {locStatus === "granted" ? "Enabled" : locStatus === "denied" ? "Blocked" : locStatus === "gps-off" ? "GPS is off" : "Not enabled"}
              </p>
            </div>
          </div>
          <Switch
            checked={locStatus === "granted"}
            onCheckedChange={handleLocationToggle}
            className="shrink-0"
          />
        </div>

        <div className="flex items-center justify-between gap-3 py-1">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-teal-50 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-teal-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">Notifications</p>
              <p className="text-xs text-gray-400">
                {notifStatus === "granted" ? "Enabled" : notifStatus === "denied" ? "Blocked" : "Not enabled"}
              </p>
            </div>
          </div>
          <Switch
            checked={notifStatus === "granted"}
            onCheckedChange={handleNotificationToggle}
            className="shrink-0"
          />
        </div>
      </div>

      {/* ABHA Linking */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <span className="text-blue-600 font-bold text-xs">AB</span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">ABHA Health ID</p>
            <p className="text-xs text-gray-400">Link your Ayushman Bharat Health Account</p>
          </div>
        </div>
        {abhaId ? (
          <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2">
            <p className="text-xs text-green-700 font-medium">✓ Linked</p>
            <p className="text-sm font-mono text-green-800">{abhaId}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {!abhaOtpSent ? (
              <button
                onClick={handleAbhaSendOtp}
                disabled={abhaLoading}
                className="w-full rounded-lg bg-blue-600 text-white text-sm font-medium py-2 hover:bg-blue-700 disabled:opacity-50"
              >
                {abhaLoading ? "Sending OTP..." : "Link ABHA via Mobile OTP"}
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">OTP sent to your registered mobile number</p>
                <input
                  type="number"
                  placeholder="Enter 6-digit OTP"
                  value={abhaOtp}
                  onChange={e => setAbhaOtp(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
                <button
                  onClick={handleAbhaVerifyOtp}
                  disabled={abhaLoading || abhaOtp.length < 6}
                  className="w-full rounded-lg bg-green-600 text-white text-sm font-medium py-2 hover:bg-green-700 disabled:opacity-50"
                >
                  {abhaLoading ? "Verifying..." : "Verify & Link ABHA"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
