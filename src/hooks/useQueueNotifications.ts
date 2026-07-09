import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { TokenStatus } from "../types";
import { onForegroundPush } from "../lib/push";
 
export function useQueueNotifications(
  sessionId: string,
  tokenNumber: number,
  currentStatus: TokenStatus,
  nowSeeingToken: number | null,
  doctorName: string | undefined,
  hospitalName: string | undefined
) {
  const lastStatusRef = useRef<TokenStatus | null>(null);
  const lastNowSeeingRef = useRef<number | null>(null);
  // Track whether we've already attempted push setup this session
  const pushSetupDone = useRef(false);

  function canShowSystemNotification(): boolean {
    return typeof Notification !== "undefined" && Notification.permission === "granted";
  }
 
  function vibrate(pattern: number | number[]) {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  }

  function buildTrackerLink(): string {
    const url = new URL("/patient/track", window.location.origin);
    url.searchParams.set("sessionId", sessionId);
    url.searchParams.set("tokenNumber", String(tokenNumber));
    return `${url.pathname}${url.search}`;
  }
 
  // ── Show a notification via the service worker (Android-compatible) ──────
  // On Android, `new Notification()` is not supported — you must go through
  // the service worker registration. This falls back gracefully on desktop.
  async function showNotification(title: string, options: NotificationOptions & { tag: string }) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, options);
    } catch {
      // Desktop fallback — new Notification() works fine here
      if (canShowSystemNotification()) {
        new Notification(title, options);
      }
    }
  }
 
  // ── Listen for foreground push messages (tab is open & focused) ──────────
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
 
    onForegroundPush(({ title, body }) => {
      toast.info(title, { description: body, duration: 7000 });
    }).then((fn) => {
      unsubscribe = fn;
    });
 
    return () => {
      unsubscribe?.();
    };
  }, []); // empty deps — subscribe once, clean up on unmount
 
  // ── React to queue status changes ─────────────────────────────────────────
  useEffect(() => {
    const isPreviousTokenCalled =
      nowSeeingToken !== null && nowSeeingToken === tokenNumber - 1;
    const previousWasCalledEarlier = lastNowSeeingRef.current === tokenNumber - 1;
 
    // Token just before yours was called → heads-up toast
    if (isPreviousTokenCalled && !previousWasCalledEarlier) {
      toast.info("Previous token called", {
        description: `Token #${tokenNumber} is next. Please stay ready at ${hospitalName}.`,
        duration: 7000,
      });
      vibrate([150, 80, 150]);
 
      if (canShowSystemNotification()) {
        showNotification("Doctor Booked - Get ready", {
          body: `Previous token is in progress. Token #${tokenNumber} is next.`,
          icon: "/assets/Logo.jpg",
          tag: `queue-${sessionId}-${tokenNumber}-previous`,
          data: { link: buildTrackerLink() },
        });
      }
    }
 
    // Status changed to "yellow" (you're next)
    if (currentStatus === "yellow" && lastStatusRef.current !== "yellow") {
      lastStatusRef.current = currentStatus;
 
      toast.success("🔔 You're Next!", {
        description: `Token #${tokenNumber} at ${hospitalName}`,
        duration: 8000,
      });
      vibrate([200, 100, 200]);
 
      if (canShowSystemNotification()) {
        showNotification("Doctor Booked - You're Next! 🎉", {
          body: `Token #${tokenNumber} at ${hospitalName}\nDr. ${doctorName} will call you soon. Get ready!`,
          icon: "/assets/Logo.jpg",
          badge: "/assets/Logo.jpg",
          tag: `queue-${sessionId}-${tokenNumber}`,
          data: { link: buildTrackerLink() },
        });
      }
    }
    // Status changed to "orange" (you're being seen)
    else if (currentStatus === "orange" && lastStatusRef.current !== "orange") {
      lastStatusRef.current = currentStatus;
 
      toast.success("🏥 You're Being Seen!", {
        description: "Go to the consultation room now!",
        duration: 6000,
      });
      vibrate([500, 100, 500]);
 
      if (canShowSystemNotification()) {
        showNotification("Your consultation is starting! 🏥", {
          body: "Please go to the consultation room now.",
          icon: "/assets/Logo.jpg",
          tag: `queue-${sessionId}-consultation`,
          data: { link: buildTrackerLink() },
        });
      }
    }
    // Any other status — just update the ref
    else if (currentStatus !== "yellow" && currentStatus !== "orange") {
      lastStatusRef.current = currentStatus;
    }
 
    lastNowSeeingRef.current = nowSeeingToken;
  }, [currentStatus, nowSeeingToken, sessionId, tokenNumber, doctorName, hospitalName]);
}
  