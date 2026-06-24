// firebase-messaging-sw.js
// Handles push notifications when the app is closed or in the background.
// This file MUST live at the site root (public/firebase-messaging-sw.js → served at /firebase-messaging-sw.js)
// so its scope covers the whole origin.
//
// NOTE: Service workers can't use import.meta.env, so the Firebase config
// values are hard-coded here. They are all PUBLIC client identifiers
// (safe to expose — this is normal for Firebase web apps, not a secret leak).
// Replace the placeholders below with your actual firebaseConfig values.

importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBME0RsUK1Yxfk1R1U2JqCZvd6tVoNn21Q",
  authDomain: "doctor-booked-bc567.firebaseapp.com",
  projectId: "doctor-booked-bc567",
  storageBucket: "doctor-booked-bc567.firebasestorage.app",
  messagingSenderId: "611968623638",
  appId: "1:611968623638:web:c0200c0fe9be986cbd8137",
});

const messaging = firebase.messaging();

// Fired when a push arrives while the app/tab is NOT focused (closed, backgrounded,
// or a different tab is active). Foreground messages are handled separately in
// src/lib/push.ts via onMessage(), so we don't double-handle them here.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "Doctor Booked";
  const body  = payload.notification?.body  || "";
  const link  = payload.fcmOptions?.link || payload.data?.link || "/";

  self.registration.showNotification(title, {
    body,
    icon: "/assets/Logo.jpg",
    badge: "/assets/Logo.jpg",
    tag: payload.data?.tag || "doctor-booked-push",
    data: { link },
  });
});

// Clicking the notification focuses an existing tab if one is open,
// otherwise opens a new one at the relevant link.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.link || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => "focus" in c);
      if (existing) {
        existing.navigate(targetUrl);
        return existing.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
