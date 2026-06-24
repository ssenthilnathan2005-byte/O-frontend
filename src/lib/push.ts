// src/lib/push.ts
// Firebase Cloud Messaging (web push) — patient-side notification setup.
//
// Flow:
//  1. registerServiceWorker() — registers /firebase-messaging-sw.js once.
//  2. enablePushNotifications() — asks for browser permission, gets a device
//     token from FCM, and POSTs it to the backend so it can be used to send
//     pushes later (booking confirmed / token called / your turn).
//  3. onForegroundPush() — shows an in-app toast-style callback when a push
//     arrives WHILE the tab is open and focused (background pushes are
//     handled by the service worker itself, not this file).

import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
  type Messaging,
} from "firebase/messaging";
import { push as pushApi } from "../api";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string;

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;
let swRegistration: ServiceWorkerRegistration | null = null;

function isConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && VAPID_KEY);
}

/** Registers the Firebase messaging service worker. Safe to call multiple times. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  if (swRegistration) return swRegistration;

  try {
    swRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    return swRegistration;
  } catch (err) {
    console.error("[push] Service worker registration failed:", err);
    return null;
  }
}

async function getMessagingInstance(): Promise<Messaging | null> {
  if (messaging) return messaging;
  if (!isConfigured()) {
    console.warn("[push] Firebase env vars not set — push notifications disabled");
    return null;
  }
  if (!(await isSupported())) {
    console.warn("[push] Firebase Messaging not supported in this browser");
    return null;
  }
  app = app ?? initializeApp(firebaseConfig);
  messaging = getMessaging(app);
  return messaging;
}

/**
 * Requests notification permission (if not already decided) and, if granted,
 * registers the device with Firebase + sends the resulting token to our backend.
 * Call this once the patient is logged in (e.g. on login, or on the token tracker page).
 *
 * Returns the FCM token on success, or null if permission was denied / unsupported.
 */
export async function enablePushNotifications(): Promise<string | null> {
  if (typeof window === "undefined" || !("Notification" in window)) return null;

  const reg = await registerServiceWorker();
  if (!reg) return null;

  const msg = await getMessagingInstance();
  if (!msg) return null;

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return null;

  try {
    const token = await getToken(msg, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: reg,
    });
    if (!token) return null;

    await pushApi.register(token);
    localStorage.setItem("db_fcm_token", token);
    return token;
  } catch (err) {
    console.error("[push] Failed to get/register FCM token:", err);
    return null;
  }
}

/** Unregisters the current device's token from the backend (call on logout). */
export async function disablePushNotifications(): Promise<void> {
  const token = localStorage.getItem("db_fcm_token");
  if (!token) return;
  try {
    await pushApi.unregister(token);
  } catch (_) {
    // best-effort — don't block logout on this
  } finally {
    localStorage.removeItem("db_fcm_token");
  }
}

/**
 * Subscribes to pushes that arrive while the tab is open and focused.
 * Returns an unsubscribe function. Use this to show a toast (e.g. via `sonner`)
 * since the OS-level notification banner is suppressed for foreground messages.
 */
export async function onForegroundPush(
  callback: (payload: { title: string; body: string; link?: string }) => void
): Promise<() => void> {
  const msg = await getMessagingInstance();
  if (!msg) return () => {};

  const unsubscribe = onMessage(msg, (payload) => {
    callback({
      title: payload.notification?.title || "Doctor Booked",
      body: payload.notification?.body || "",
      link: (payload.fcmOptions?.link as string) || (payload.data?.link as string) || undefined,
    });
  });

  return unsubscribe;
}
