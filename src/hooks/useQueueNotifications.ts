import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { TokenStatus } from "../types";

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

  function vibrate(pattern: number | number[]) {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  }

  // Request permission first time
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const isPreviousTokenCalled = nowSeeingToken !== null && nowSeeingToken === tokenNumber - 1;
    const previousWasCalledEarlier = lastNowSeeingRef.current === tokenNumber - 1;

    if (isPreviousTokenCalled && !previousWasCalledEarlier) {
      toast.info("Previous token called", {
        description: `Token #${tokenNumber} is next. Please stay ready at ${hospitalName}.`,
        duration: 7000,
      });

      vibrate([150, 80, 150]);

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Doctor Booked - Get ready", {
          body: `Previous token is in progress. Token #${tokenNumber} is next.`,
          icon: "/assets/Logo.jpg",
          tag: `queue-${sessionId}-${tokenNumber}-previous`,
        });
      }
    }

    // Trigger when status changes to "yellow" (next up)
    if (
      currentStatus === "yellow" &&
      lastStatusRef.current !== "yellow"
    ) {
      lastStatusRef.current = currentStatus;

      // Show in-app toast
      toast.success("🔔 You're Next!", {
        description: `Token #${tokenNumber} at ${hospitalName}`,
        duration: 8000,
      });

      vibrate([200, 100, 200]);

      // Show browser notification
      if (
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        const notification = new Notification(
          "Doctor Booked - You're Next! 🎉",
          {
            body: `Token #${tokenNumber} at ${hospitalName}\nDr. ${doctorName} will call you soon. Get ready!`,
            icon: "/assets/Logo.jpg",
            badge: "/assets/Logo.jpg",
            tag: `queue-${sessionId}-${tokenNumber}`,
          }
        );

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      }
    }
    // Also notify when being seen (orange)
    else if (
      currentStatus === "orange" &&
      lastStatusRef.current !== "orange"
    ) {
      lastStatusRef.current = currentStatus;

      toast.success("🏥 You're Being Seen!", {
        description: "Go to the consultation room now!",
        duration: 6000,
      });

      vibrate([500, 100, 500]);

      if (
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification("Your consultation is starting! 🏥", {
          body: "Please go to the consultation room now.",
          icon: "/assets/Logo.jpg",
          tag: `queue-${sessionId}-consultation`,
        });
      }
    }
    // Reset for other statuses
    else if (currentStatus !== "yellow" && currentStatus !== "orange") {
      lastStatusRef.current = currentStatus;
    }

    lastNowSeeingRef.current = nowSeeingToken;
  }, [currentStatus, nowSeeingToken, sessionId, tokenNumber, doctorName, hospitalName]);
}
