import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserCog, Loader2, Save, CheckCircle2, MapPin, Bell, ExternalLink } from "lucide-react";
import { patients } from "../../api";
import { useRouter } from "../../router/RouterContext";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { enablePushNotifications } from "../../lib/push";
import { Switch } from "@/components/ui/switch";

type PermStatus = "granted" | "denied" | "prompt" | "gps-off" | "unknown";

export default function ProfilePage() {
  const { navigate } = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [wasComplete, setWasComplete] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
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
      const res = await Geolocation.checkPermissions();
      const status = res.location || res.coarseLocation;
      if (status === "granted") {
        // Permission is granted, but that doesn't mean GPS itself is on -
        // actually try to get a position (short timeout) to find out.
        try {
          await Geolocation.getCurrentPosition({ timeout: 5000, maximumAge: 60000 });
          setLocStatus("granted");
        } catch (posErr) {
          setLocStatus(isGpsOffError(posErr) ? "gps-off" : "granted");
        }
      } else {
        setLocStatus(status === "denied" ? "denied" : "prompt");
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
    if (!Capacitor.isNativePlatform()) return;
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
      toast.error("Please enable this in your browser's site settings.");
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
        setPhone(data.phone || "");
        setAge(data.age || "");
        setWasComplete(data.isComplete);
      } catch (err: any) {
        toast.error(err.message || "Could not load your profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function isValidPhone(value: string): boolean {
    return /^\d{10}$/.test(value.trim());
  }

  async function handleSave() {
    if (!name.trim() || !phone.trim() || !age.trim()) {
      toast.error("Please fill in your name, phone number, and age");
      return;
    }
    if (!isValidPhone(phone)) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }
    const ageNum = Number(age);
    if (!Number.isFinite(ageNum) || ageNum <= 0 || ageNum > 120) {
      toast.error("Please enter a valid age");
      return;
    }

    setSaving(true);
    try {
      await patients.updateProfile({ name: name.trim(), phone: phone.trim(), age: age.trim() });
      toast.success("Profile saved");
      setWasComplete(true);
      navigate({ path: "/" });
    } catch (err: any) {
      toast.error(err.message || "Could not save your profile");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500 mx-auto" />
      </div>
    );
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
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Phone Number <span className="text-red-500">*</span></label>
          <input
            type="tel"
            inputMode="numeric"
            placeholder="Enter 10-digit phone number"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Age <span className="text-red-500">*</span></label>
          <input
            type="number"
            placeholder="Enter your age"
            value={age}
            onChange={e => setAge(e.target.value)}
            min={0} max={120}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
          />
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
    </div>
  );
}
