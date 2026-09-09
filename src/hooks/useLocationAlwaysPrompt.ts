import { useState, useCallback, useEffect } from "react";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";

type PromptState = "checking" | "hidden" | "show";

const DISMISS_KEY = "db_location_always_dismissed_session";
const CONFIRM_KEY = "db_location_always_confirmed";

export function useLocationAlwaysPrompt(enabled: boolean) {
  const [state, setState] = useState<PromptState>("checking");

  const evaluate = useCallback(async () => {
    if (!enabled || !Capacitor.isNativePlatform()) {
      setState("hidden");
      return;
    }
    if (sessionStorage.getItem(DISMISS_KEY)) {
      setState("hidden");
      return;
    }
    try {
      const perm = await Geolocation.checkPermissions();
      if (perm.location === "granted" && !sessionStorage.getItem(CONFIRM_KEY)) {
        setState("show");
      } else if (perm.location !== "granted") {
        setState("show");
      } else {
        setState("hidden");
      }
    } catch {
      setState("hidden");
    }
  }, [enabled]);

  useEffect(() => { evaluate(); }, [evaluate]);

  const dismiss = useCallback(() => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setState("hidden");
  }, []);

  const confirmAlways = useCallback(() => {
    sessionStorage.setItem(CONFIRM_KEY, "1");
    sessionStorage.setItem(DISMISS_KEY, "1");
    setState("hidden");
  }, []);

  return { state, dismiss, confirmAlways, recheck: evaluate };
}
