import { MapPin, X } from "lucide-react";
import { Geolocation } from "@capacitor/geolocation";
import { NativeSettings, AndroidSettings } from "capacitor-native-settings";
import { useLocationAlwaysPrompt } from "../hooks/useLocationAlwaysPrompt";

export default function LocationAlwaysPrompt({ enabled }: { enabled: boolean }) {
  const { state, dismiss, confirmAlways } = useLocationAlwaysPrompt(enabled);

  if (state !== "show") return null;

  async function handleEnable() {
    try {
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== "granted") {
        await Geolocation.requestPermissions();
      }
      await NativeSettings.openAndroid({
        option: AndroidSettings.ApplicationDetails,
      });
    } catch {
      // best-effort; nothing to recover from here
    } finally {
      confirmAlways();
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 px-4 pb-6 sm:pb-0">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 relative">
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center mb-4">
          <MapPin className="w-6 h-6 text-teal-600" />
        </div>

        <h2 className="text-lg font-bold text-gray-900 mb-2">Turn on location — Always</h2>
        <p className="text-sm text-gray-600 mb-6">
          To show nearby hospitals and keep your queue status accurate even when the app is in the background,
          please set location access to <span className="font-semibold">"Allow all the time"</span> in Settings.
        </p>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleEnable}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm py-3 rounded-xl transition-colors"
          >
            Open Settings
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="w-full text-gray-500 text-sm py-2 font-medium"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
