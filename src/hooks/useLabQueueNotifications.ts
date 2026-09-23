import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { LabSessionState } from "../api";

type LabTokenStatus = "red" | "yellow" | "orange" | "green" | "purple" | undefined;

export function useLabQueueNotifications(
  session: LabSessionState | null,
  myToken: number | null,
  bookingId: string,
  labName: string | undefined,
  testName: string | undefined
) {
  const lastStateRef = useRef<LabTokenStatus>(undefined);
  const lastNowServingRef = useRef<number | null>(null);
  const mountedOnceRef = useRef(false);

  function canShowSystemNotification(): boolean {
    if (Capacitor.isNativePlatform()) return true;
    return typeof Notification !== "undefined" && Notification.permission === "granted";
  }

  function vibrate(pattern: number | number[]) {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  }

  function buildTrackingLink(): string {
    return `/labs/track?bookingId=${bookingId}`;
  }

  async function showNotification(title: string, options: NotificationOptions & { tag: string }) {
    if (Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.requestPermissions();
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Math.random() * 2147483647),
              title,
              body: (options.body as string) || "",
              extra: options.data as Record<string, unknown> | undefined,
            },
          ],
        });
      } catch (err) {
        console.error("[push] Native local notification failed:", err);
      }
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, options);
    } catch {
      if (canShowSystemNotification()) {
        new Notification(title, options);
      }
    }
  }

  useEffect(() => {
    if (myToken == null) return;

    const statuses = session?.tokenStatuses ?? {};
    const myState = statuses[String(myToken)] as LabTokenStatus;
    const nowServing = session?.currentToken ?? null;

    const label = labName || "the lab";
    const test = testName || "your test";
    const link = buildTrackingLink();

    // Skip on first mount — don't notify for already-existing state
    if (!mountedOnceRef.current) {
      mountedOnceRef.current = true;
      lastStateRef.current = myState;
      lastNowServingRef.current = nowServing;
      return;
    }

    // Heads-up: the token right before yours just got called
    const isPreviousCalled = nowServing !== null && nowServing === myToken - 1;
    const previousWasCalledEarlier = lastNowServingRef.current === myToken - 1;
    if (isPreviousCalled && !previousWasCalledEarlier) {
      toast.info("Previous token called", {
        description: `Token #${myToken} is next at ${label}. Please stay ready.`,
        duration: 7000,
      });
      vibrate([150, 80, 150]);
      if (canShowSystemNotification()) {
        showNotification("Doctor Booked - Get ready", {
          body: `Previous token is in progress. Token #${myToken} is next at ${label}.`,
          icon: "/assets/Logo.jpg",
          tag: `lab-queue-${bookingId}-previous`,
          data: { link },
        });
      }
    }

    if (myState !== lastStateRef.current) {
      lastStateRef.current = myState;

      if (myState === "yellow") {
        toast.success("🔔 You're Next!", {
          description: `Token #${myToken} at ${label}`,
          duration: 8000,
        });
        vibrate([200, 100, 200]);
        if (canShowSystemNotification()) {
          showNotification("Doctor Booked - You're Next! 🎉", {
            body: `Token #${myToken} at ${label}. Get ready for your ${test} sample collection.`,
            icon: "/assets/Logo.jpg",
            badge: "/assets/Logo.jpg",
            tag: `lab-queue-${bookingId}-yellow`,
            data: { link },
          });
        }
      } else if (myState === "orange") {
        toast.success("🧪 It's Your Turn!", {
          description: `Please proceed now for ${test} at ${label}.`,
          duration: 6000,
        });
        vibrate([500, 100, 500]);
        if (canShowSystemNotification()) {
          showNotification("Your turn has arrived! 🧪", {
            body: `Token #${myToken} - ${label} is ready for your ${test} sample collection.`,
            icon: "/assets/Logo.jpg",
            tag: `lab-queue-${bookingId}-orange`,
            data: { link },
          });
        }
      } else if (myState === "purple") {
        toast.error("⚠️ Token Skipped", {
          description: `Your token was skipped — please contact ${label}.`,
          duration: 8000,
        });
        vibrate([500]);
        if (canShowSystemNotification()) {
          showNotification("Doctor Booked - Token Skipped", {
            body: `Your token was skipped at ${label}. Please contact the lab.`,
            icon: "/assets/Logo.jpg",
            tag: `lab-queue-${bookingId}-skipped`,
            data: { link },
          });
        }
      }
    }

    lastNowServingRef.current = nowServing;
  }, [session?.currentToken, session?.tokenStatuses, myToken, bookingId, labName, testName]);
}
