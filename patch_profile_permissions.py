import sys, os

path = "src/pages/patient/ProfilePage.tsx"
if not os.path.exists(path):
    print(f"ERROR: run this from the O-frontend root. Could not find {path}")
    sys.exit(1)

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Imports
old_imports = '''import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserCog, Loader2, Save, CheckCircle2 } from "lucide-react";
import { patients } from "../../api";
import { useRouter } from "../../router/RouterContext";'''

new_imports = '''import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserCog, Loader2, Save, CheckCircle2, MapPin, Bell, ExternalLink } from "lucide-react";
import { patients } from "../../api";
import { useRouter } from "../../router/RouterContext";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { enablePushNotifications } from "../../lib/push";

type PermStatus = "granted" | "denied" | "prompt" | "unknown";'''

if old_imports not in content:
    print("ERROR: imports anchor not found, aborting without changes.")
    sys.exit(1)
content = content.replace(old_imports, new_imports, 1)

# 2. State + permission-checking logic, inserted right after existing state hooks
old_state = '''  const [age, setAge] = useState("");

  useEffect(() => {'''

new_state = '''  const [age, setAge] = useState("");
  const [locStatus, setLocStatus] = useState<PermStatus>("unknown");
  const [notifStatus, setNotifStatus] = useState<PermStatus>("unknown");

  async function refreshPermissionStatuses() {
    try {
      const res = await Geolocation.checkPermissions();
      const status = res.location || res.coarseLocation;
      setLocStatus(status === "granted" ? "granted" : status === "denied" ? "denied" : "prompt");
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

  async function openAppSettings(option: "ApplicationDetails" | "AppNotification") {
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
    try {
      const res = await Geolocation.requestPermissions();
      const status = res.location || res.coarseLocation;
      setLocStatus(status === "granted" ? "granted" : status === "denied" ? "denied" : "prompt");
      if (status === "granted") toast.success("Location access enabled");
    } catch {
      toast.error("Could not update location permission");
    }
  }

  async function handleNotificationClick() {
    if (notifStatus === "denied") {
      await openAppSettings("AppNotification");
      return;
    }
    const token = await enablePushNotifications();
    if (token) {
      setNotifStatus("granted");
      toast.success("Notifications enabled");
    } else {
      toast.error("Could not enable notifications");
      await refreshPermissionStatuses();
    }
  }

  useEffect(() => {'''

if old_state not in content:
    print("ERROR: state anchor not found, aborting without changes.")
    sys.exit(1)
content = content.replace(old_state, new_state, 1)

# 3. New Permissions card in the JSX, right after the profile form card
old_jsx_end = '''        </button>
      </div>
    </div>
  );
}'''

new_jsx_end = '''        </button>
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
                {locStatus === "granted" ? "Enabled" : locStatus === "denied" ? "Blocked" : "Not enabled"}
              </p>
            </div>
          </div>
          {locStatus === "granted" ? (
            <CheckCircle2 className="w-5 h-5 text-teal-500 shrink-0" />
          ) : (
            <button
              type="button"
              onClick={handleLocationClick}
              className="shrink-0 flex items-center gap-1 text-xs font-semibold text-teal-600 border border-teal-300 rounded-full px-3 py-1.5 hover:bg-teal-50"
            >
              {locStatus === "denied" ? <><ExternalLink className="w-3.5 h-3.5" /> Settings</> : "Enable"}
            </button>
          )}
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
          {notifStatus === "granted" ? (
            <CheckCircle2 className="w-5 h-5 text-teal-500 shrink-0" />
          ) : (
            <button
              type="button"
              onClick={handleNotificationClick}
              className="shrink-0 flex items-center gap-1 text-xs font-semibold text-teal-600 border border-teal-300 rounded-full px-3 py-1.5 hover:bg-teal-50"
            >
              {notifStatus === "denied" ? <><ExternalLink className="w-3.5 h-3.5" /> Settings</> : "Enable"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}'''

if old_jsx_end not in content:
    print("ERROR: JSX end anchor not found, aborting without changes.")
    sys.exit(1)
content = content.replace(old_jsx_end, new_jsx_end, 1)

backup = path + ".bak"
with open(backup, "w", encoding="utf-8") as f:
    f.write(open(path, encoding="utf-8").read())
print(f"Backup saved to {backup}")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Patched successfully: {path}")
