import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { LabBooking } from "../api";

export function useLabStatusNotifications(booking: LabBooking | null) {
  const lastStatusRef = useRef<LabBooking["status"] | null>(null);

  function canShowSystemNotification(): boolean {
    if (Capacitor.isNativePlatform()) return true;
    return typeof Notification !== "undefined" && Notification.permission === "granted";
  }

  function vibrate(pattern: number | number[]) {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  }

  function buildTrackingLink(bookingId: string): string {
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
    if (!booking) return;
    const status = booking.status;
    const prev = lastStatusRef.current;

    // Skip on first mount — don't notify for already-existing status
    if (prev === null) {
      lastStatusRef.current = status;
      return;
    }

    // No change
    if (status === prev) return;

    lastStatusRef.current = status;

    const labName = booking.lab_name || "the lab";
    const testName = booking.test_name || "your test";
    const link = buildTrackingLink(booking.id);

    if (status === "technician_assigned") {
      toast.info("🧑‍⚕️ Technician Assigned", {
        description: `A technician has been assigned for ${testName}.`,
        duration: 7000,
      });
      vibrate([150, 80, 150]);
      if (canShowSystemNotification()) {
        showNotification("Doctor Booked - Technician Assigned", {
          body: `A technician has been assigned for ${testName} at ${labName}.`,
          icon: "/assets/Logo.jpg",
          tag: `lab-${booking.id}-technician`,
          data: { link },
        });
      }
    } else if (status === "sample_collected") {
      toast.info("🧪 Sample Collected", {
        description: `Your sample for ${testName} has been collected.`,
        duration: 7000,
      });
      vibrate([150, 80, 150]);
      if (canShowSystemNotification()) {
        showNotification("Doctor Booked - Sample Collected", {
          body: `Your sample for ${testName} has been collected at ${labName}.`,
          icon: "/assets/Logo.jpg",
          tag: `lab-${booking.id}-sample`,
          data: { link },
        });
      }
    } else if (status === "processing") {
      toast.info("⚙️ Processing", {
        description: `Your ${testName} sample is being processed.`,
        duration: 7000,
      });
      vibrate([100]);
      if (canShowSystemNotification()) {
        showNotification("Doctor Booked - Processing", {
          body: `Your ${testName} sample is being processed at ${labName}.`,
          icon: "/assets/Logo.jpg",
          tag: `lab-${booking.id}-processing`,
          data: { link },
        });
      }
    } else if (status === "report_ready") {
      toast.success("📄 Report Ready!", {
        description: `Your ${testName} report from ${labName} is ready to view.`,
        duration: 10000,
      });
      vibrate([300, 100, 300, 100, 300]);
      if (canShowSystemNotification()) {
        showNotification("Doctor Booked - Report Ready 📄", {
          body: `Your ${testName} report from ${labName} is ready to view.`,
          icon: "/assets/Logo.jpg",
          badge: "/assets/Logo.jpg",
          tag: `lab-${booking.id}-report`,
          data: { link },
        });
      }
    } else if (status === "cancelled") {
      toast.error("❌ Booking Cancelled", {
        description: booking.notes || `Your ${testName} booking was cancelled.`,
        duration: 8000,
      });
      vibrate([500]);
      if (canShowSystemNotification()) {
        showNotification("Doctor Booked - Booking Cancelled", {
          body: booking.notes || `Your ${testName} booking at ${labName} was cancelled.`,
          icon: "/assets/Logo.jpg",
          tag: `lab-${booking.id}-cancelled`,
          data: { link },
        });
      }
    }
  }, [booking?.status]);
}
