import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Capacitor } from "@capacitor/core";
import * as api from "../api";
import { toast } from "sonner";
import { useRouter } from "../router/RouterContext";
import type {
  AppUser, Booking, Doctor, Hospital,
  PatientRecord, PrioritySlotState, SessionTokenState,
} from "../api";

export type { AppUser, Booking, Doctor, Hospital, PatientRecord, SessionTokenState };
export type AppStore = ReturnType<typeof useStore>;

interface Store {
  user: AppUser | null;
  serverStatus: "ok" | "waking" | "offline";
  login: (u: AppUser, token: string) => void;
  logout: () => void;
  hospitals: Hospital[];
  addHospital: (data: Partial<Hospital>) => Promise<void>;
  updateHospital: (id: string, data: Partial<Hospital>) => Promise<void>;
  updateHospitalPhoto: (id: string, photoUrlOrBase64: string) => Promise<void>;
  deleteHospital: (id: string, _doctors: Doctor[]) => Promise<boolean>;
  doctors: Doctor[];
  addDoctor: (data: Omit<Doctor, "id" | "code">) => Promise<Doctor>;
  updateDoctor: (id: string, data: Partial<Doctor>) => Promise<void>;
  deleteDoctor: (id: string) => Promise<void>;
  bookings: Booking[];
  addBooking: (data: {
    id?: string; patientId?: string; patientName?: string;
    doctorId: string; doctorName?: string; hospitalName?: string;
    date: string; session: string; tokenNumber?: number; sessionId?: string;
    paymentDone?: boolean; status?: string;
    complaint?: string; phone: string;
  }) => Promise<void>;
  addBookingToStore: (booking: Booking) => void;
  getBookingsForPatient: (patientId: string) => Booking[];
  getBookingsForSession: (sessionId: string) => Booking[];
  patients: PatientRecord[];
  tokenStates: Record<string, SessionTokenState>;
  getOrCreateTokenState: (sid: string, doctorId: string, date: string, session: string) => SessionTokenState;
  bookToken: (sid: string, doctorId: string, date: string, session: string, tokenNumber: number) => void;
  regulateToken: (sid: string, clickedToken: number) => Promise<void>;
  completeCurrentToken: (sid: string) => Promise<void>;
  skipToken: (sid: string, tokenNum?: number) => Promise<void>;
  completeSkippedToken: (sid: string, tokenNum: number) => Promise<void>;
  closeSession: (sid: string, reason: string) => Promise<void>;
  setPrioritySlot: (sid: string, slotIndex: number, slot: PrioritySlotState) => Promise<void>;
  cancelSession: (doctorId: string, date: string, session: string) => Promise<void>;
  isSessionCancelled: (doctorId: string, date: string, session: string) => boolean;
  getStats: () => { totalHospitals: number; totalDoctors: number; totalPatients: number; totalBookings: number; activeSessions: number };
  notification: string | null;
  setNotification: (n: string | null) => void;
  hasNewPrescription: boolean;
  clearPrescriptionDot: () => void;
  refreshFromStorage: () => Promise<void>;
  getPatientCredentials: () => Record<string, { name: string; password: string }>;
  getPatientNameIndex: () => Record<string, string>;
  savePatientCredential: (email: string, name: string, password: string) => void;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore must be inside StoreProvider");
  return c;
}

const REFRESH_MS = 10_000; // 10 seconds

export function StoreProvider({ children }: { children: ReactNode }) {
  const { navigate } = useRouter();

  // Auto-register push for already logged-in patients on app start
  useEffect(() => {
    const stored = localStorage.getItem("db_user");
    if (!stored) return;
    try {
      const u = JSON.parse(stored);
      if (u?.role === "patient") {
        import("../lib/push").then(({ registerServiceWorker, enablePushNotifications }) => {
          if (Capacitor.isNativePlatform()) {
            enablePushNotifications().catch(() => {});
          } else {
            registerServiceWorker().then(() => {
              enablePushNotifications().catch(() => {});
            });
          }
        });
      }
    } catch {}
  }, []);

  const [user, setUser] = useState<AppUser | null>(() => {
    try { return JSON.parse(localStorage.getItem("db_user") || "null"); } catch { return null; }
  });
  const [serverStatus, setServerStatus] = useState<"ok" | "waking" | "offline">("ok");
  const [hospitals, setHospitals]     = useState<Hospital[]>([]);
  const [doctors, setDoctors]         = useState<Doctor[]>([]);
  const [bookings, setBookings]       = useState<Booking[]>([]);
  const [patients, setPatients]       = useState<PatientRecord[]>([]);
  const [tokenStates, setTokenStates] = useState<Record<string, SessionTokenState>>({});
  const [cancelled, setCancelled]     = useState<string[]>([]);
  const [notification, setNotification] = useState<string | null>(null);
  const [hasNewPrescription, setHasNewPrescription] = useState(false);

  const wsRefs       = useRef<Record<string, () => void>>({});
  const userRef      = useRef<AppUser | null>(user);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { userRef.current = user; }, [user]);

  // ── Subscribe to server status events from api.ts ─────────────────────────
  useEffect(() => {
    const unsub = api.onServerStatus(setServerStatus);
    return () => { unsub(); };   // wrap so return type is void, not boolean
  }, []);

  // ── Core data loader ──────────────────────────────────────────────────────
  // Background = true means errors are silently swallowed (periodic refresh)
  // Background = false means errors propagate (initial load after login)
  const loadCoreData = useCallback(async (u: AppUser | null, background = false) => {
    if (u?.role === "hospital_admin") {
      try {
        const [h, d] = await Promise.all([
          api.hospitals.get(u.hospitalId),
          api.doctors.list(u.hospitalId),
        ]);
        setHospitals(h ? [h] : []);
        setDoctors(d);
      } catch (err) {
        if (!background) console.error("[store] hospital admin hospitals/doctors load failed:", err);
      }
    } else {
      try {
        const [h, d] = await Promise.all([
          api.hospitals.list(),
          api.doctors.list(),
        ]);
        setHospitals(h);
        setDoctors(d);
      } catch (err) {
        // On initial load, keep whatever data we already have
        // On background refresh, just skip silently — will retry in 30s
        if (!background) console.error("[store] initial hospitals/doctors load failed:", err);
      }
    }

    // Cancelled sessions — always silent
    api.tokens.getCancelledSessions().then(setCancelled).catch(() => {});

    if (!u) return;

    try {
      const b = await api.bookings.list(u.role === "hospital_admin" ? u.hospitalId : undefined);
      setBookings(b);
    } catch (err) {
      if (!background) console.error("[store] bookings load failed:", err);
      // Some backends block global /bookings for hospital admins.
      // Try hospital-scoped endpoint fallback instead.
      if (u.role === "hospital_admin") {
        try {
          const fallback = await api.bookings.forHospital(u.hospitalId);
          setBookings(fallback);
        } catch (fallbackErr) {
          if (!background) console.error("[store] hospital bookings fallback failed:", fallbackErr);
        }
      }
    }

    if (u.role === "admin") {
      try {
        const p = await api.patients.list();
        setPatients(p);
      } catch (err) {
        if (!background) console.error("[store] patients load failed:", err);
      }
    }
  }, []);

  // ── Initial load + periodic refresh ───────────────────────────────────────
  useEffect(() => {
    loadCoreData(user, false);

    if (refreshTimer.current) clearInterval(refreshTimer.current);
    refreshTimer.current = setInterval(() => {
      loadCoreData(userRef.current, true); // background = silent
    }, REFRESH_MS);

    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current); };
  }, [user]); // eslint-disable-line

  // ── Reload on tab focus ───────────────────────────────────────────────────
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") loadCoreData(userRef.current, true);
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []); // eslint-disable-line

  // ── WebSocket ─────────────────────────────────────────────────────────────
  const subscribe = useCallback((sid: string) => {
    if (wsRefs.current[sid]) return;
    wsRefs.current[sid] = api.connectTokenSocket(sid, (msg) => {
      if (msg.type === "state_update" && msg.state)
        setTokenStates(p => ({ ...p, [sid]: msg.state! }));
      else if (msg.type === "token_booked") {
        api.tokens.getState(sid)
          .then(s => { if (s) setTokenStates(p => ({ ...p, [sid]: s })); })
          .catch(() => {});
        api.bookings.forSession(sid)
          .then(bs => setBookings(p => {
            const others = p.filter(b => b.sessionId !== sid);
            return [...others, ...bs];
          }))
          .catch(() => {});
      }
      else if (msg.type === "prescription_created") {
        const doctorName = (msg as { doctorName?: string }).doctorName;
        setHasNewPrescription(true);
        toast.success("💊 New Prescription!", {
          description: doctorName ? `Dr. ${doctorName} has prescribed your medicines.` : "Your doctor has prescribed your medicines.",
          duration: 6000,
        });
        window.setTimeout(() => {
          navigate({ path: "/patient/prescriptions" });
        }, 3200);
      }
    });
  }, [navigate]);

  // ── Global prescription notifications ─────────────────────────────
  // Subscribe to this patient's personal WS room so a new prescription
  // shows up instantly no matter what page they're on, mirroring the
  // booking flow's "green check + auto redirect" behaviour.
  useEffect(() => {
    if (!user || user.role !== "patient") return;
    subscribe(`patient_${user.id}`);
  }, [user, subscribe]);

  // ── Auto-subscribe to all active booking sessions globally ───────────────────
  // Ensures tokenStates are populated for every active booking so
  // notifications fire on ANY page, not just TokenTrackerPage.
  useEffect(() => {
    if (!user || user.role !== "patient") return;
    const activeBookings = bookings.filter(b => b.status === "confirmed" && b.paymentDone);
    for (const b of activeBookings) {
      subscribe(b.sessionId);
      api.tokens.getState(b.sessionId)
        .then(s => { if (s) setTokenStates(p => ({ ...p, [b.sessionId]: s })); })
        .catch(() => {});
    }
  }, [bookings, user, subscribe]);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const login = useCallback((u: AppUser, token: string) => {
    api.setToken(token);
    localStorage.setItem("db_user", JSON.stringify(u));
    setUser(u);
    // Auto-register push notifications for patients on login
    if (u.role === "patient") {
      import("../lib/push").then(({ registerServiceWorker, enablePushNotifications }) => {
        if (Capacitor.isNativePlatform()) {
          enablePushNotifications().catch(() => {});
        } else {
          registerServiceWorker().then(() => {
            enablePushNotifications().catch(() => {});
          });
        }
      });
    }
  }, []);

  // ── Global foreground push listener ────────────────────────────────────────
  // Subscribed once per logged-in patient session, independent of which page
  // they're on. Shows an in-app toast everywhere, and on native also fires a
  // real system tray notification (foreground FCM messages don't auto-display
  // on native, unlike backgrounded/killed states which Android handles itself).
  useEffect(() => {
    if (!user || user.role !== "patient") return;
    let unsubscribe: (() => void) | null = null;
    import("../lib/push").then(({ onForegroundPush }) => {
      onForegroundPush(({ title, body, link }) => {
        toast.info(title, {
          description: body,
          duration: 7000,
          action: link ? { label: "View", onClick: () => navigate(link) } : undefined,
        });

        if (Capacitor.isNativePlatform()) {
          import("@capacitor/local-notifications").then(({ LocalNotifications }) => {
            LocalNotifications.requestPermissions()
              .then(() => LocalNotifications.schedule({
                notifications: [
                  {
                    id: Math.floor(Math.random() * 2147483647),
                    title,
                    body,
                    extra: link ? { link } : undefined,
                  },
                ],
              }))
              .catch((err) => console.error("[push] Native local notification failed:", err));
          });
        }
      }).then((fn) => {
        unsubscribe = fn;
      });
    });
    return () => {
      unsubscribe?.();
    };
  }, [user?.id, user?.role]);

  const logout = useCallback(() => {
    import("../lib/push").then(({ disablePushNotifications }) => {
      disablePushNotifications();
    });
    api.clearToken();
    localStorage.removeItem("db_user");
    setUser(null); setBookings([]); setPatients([]); setTokenStates({});
    Object.values(wsRefs.current).forEach(fn => fn());
    wsRefs.current = {};
  }, []);

  // ── Hospitals ─────────────────────────────────────────────────────────────
  const addHospital = useCallback(async (data: Partial<Hospital>) => {
    const h = await api.hospitals.create(data);
    setHospitals(p => [...p, h]);
    api.hospitals.list().then(setHospitals).catch(() => {});
  }, []);

  const updateHospital = useCallback(async (id: string, data: Partial<Hospital>) => {
    const h = await api.hospitals.update(id, data);
    setHospitals(p => p.map(x => x.id === id ? h : x));
    api.hospitals.list().then(setHospitals).catch(() => {});
  }, []);

  const updateHospitalPhoto = useCallback(async (id: string, photoUrlOrBase64: string) => {
    let photoUrl: string;
    if (photoUrlOrBase64.startsWith("data:")) {
      const result = await api.hospitals.uploadPhotoBase64(id, photoUrlOrBase64);
      photoUrl = result.photoUrl;
    } else {
      photoUrl = photoUrlOrBase64;
    }
    setHospitals(p => p.map(x => x.id === id ? { ...x, photoUrl } : x));
    api.hospitals.list().then(setHospitals).catch(() => {});
  }, []);

  const deleteHospital = useCallback(async (id: string, _docs: Doctor[]) => {
    try {
      await api.hospitals.delete(id);
      setHospitals(p => p.filter(h => h.id !== id));
      return true;
    } catch (e: any) {
      if (e.message?.includes("assigned doctors")) return false;
      throw e;
    }
  }, []);

  // ── Doctors ───────────────────────────────────────────────────────────────
  const addDoctor = useCallback(async (data: Omit<Doctor, "id" | "code">) => {
    const d = await api.doctors.create(data as Partial<Doctor>);
    setDoctors(p => [...p, d]);
    api.doctors.list().then(setDoctors).catch(() => {});
    return d;
  }, []);

  const updateDoctor = useCallback(async (id: string, data: Partial<Doctor>) => {
    const d = await api.doctors.update(id, data);
    setDoctors(p => p.map(x => x.id === id ? d : x));
  }, []);

  const deleteDoctor = useCallback(async (id: string) => {
    await api.doctors.delete(id);
    setDoctors(p => p.filter(d => d.id !== id));
    setBookings(p => p.map(b =>
      b.doctorId === id ? { ...b, status: "cancelled" as const } : b
    ));
    api.hospitals.list().then(setHospitals).catch(() => {});
  }, []);

  // ── Bookings ──────────────────────────────────────────────────────────────
  const addBooking = useCallback(async (data: any) => {
    const b = await api.bookings.create({
      doctorId: data.doctorId, date: data.date,
      session: data.session, complaint: data.complaint, phone: data.phone,
    });
    setBookings(p => [...p, b]);
    subscribe(b.sessionId);
  }, [subscribe]);

  // Called by BookingDialog after Razorpay payment succeeds — adds booking to local state
  const addBookingToStore = useCallback((booking: Booking) => {
    setBookings(p => [...p.filter(b => b.id !== booking.id), booking]);
    subscribe(booking.sessionId);
  }, [subscribe]);

  const getBookingsForPatient = useCallback((pid: string) =>
    bookings.filter(b => b.patientId === pid), [bookings]);

  const getBookingsForSession = useCallback((sid: string) =>
    bookings.filter(b => b.sessionId === sid), [bookings]);

  // ── Token states ──────────────────────────────────────────────────────────
  const EMPTY = (sid: string, doctorId: string, date: string, session: string): SessionTokenState => ({
    sessionId: sid, doctorId, date, session,
    tokenStatuses: {}, prioritySlots: {},
    currentToken: null, nextToken: null,
    isClosed: false, cancelledSessions: [],
  });

  const getOrCreateTokenState = useCallback((sid: string, doctorId: string, date: string, session: string) => {
    if (!tokenStates[sid]) {
      api.tokens.getState(sid)
        .then(s => setTokenStates(p => ({ ...p, [sid]: s ?? EMPTY(sid, doctorId, date, session) })))
        .catch(() => {});
      subscribe(sid);
      return EMPTY(sid, doctorId, date, session);
    }
    subscribe(sid);
    return tokenStates[sid];
  }, [tokenStates, subscribe]); // eslint-disable-line

  const bookToken = useCallback(() => {}, []);

  const regulateToken = useCallback(async (sid: string, clickedToken: number) => {
    const [s, bs] = await Promise.all([
      api.tokens.regulate(sid, clickedToken),
      api.bookings.forSession(sid),
    ]);
    setTokenStates(p => ({ ...p, [sid]: s }));
    setBookings(p => {
      const others = p.filter(b => b.sessionId !== sid);
      return [...others, ...bs];
    });
  }, []);

  const completeCurrentToken = useCallback(async (sid: string) => {
    const [s, bs] = await Promise.all([
      api.tokens.complete(sid),
      api.bookings.forSession(sid),
    ]);
    setTokenStates(p => ({ ...p, [sid]: s }));
    setBookings(p => {
      const others = p.filter(b => b.sessionId !== sid);
      return [...others, ...bs];
    });
  }, []);

  const skipToken = useCallback(async (sid: string, tokenNum?: number) => {
    const [s, bs] = await Promise.all([
      api.tokens.skip(sid, tokenNum),
      api.bookings.forSession(sid),
    ]);
    setTokenStates(p => ({ ...p, [sid]: s }));
    setBookings(p => {
      const others = p.filter(b => b.sessionId !== sid);
      return [...others, ...bs];
    });
  }, []);

  const completeSkippedToken = useCallback(async (sid: string, tokenNum: number) => {
    const [s, bs] = await Promise.all([
      api.tokens.completeSkipped(sid, tokenNum),
      api.bookings.forSession(sid),
    ]);
    setTokenStates(p => ({ ...p, [sid]: s }));
    setBookings(p => {
      const others = p.filter(b => b.sessionId !== sid);
      return [...others, ...bs];
    });
  }, []);

  const closeSession = useCallback(async (sid: string, reason: string) => {
    const s = await api.tokens.closeSession(sid, reason);
    setTokenStates(p => ({ ...p, [sid]: s }));
    setBookings(p => p.map(b =>
      b.sessionId === sid && b.status === "confirmed"
        ? { ...b, status: "unvisited" as const, closeReason: reason || null } : b
    ));
  }, []);

  const setPrioritySlot = useCallback(async (sid: string, slotIndex: number, slot: PrioritySlotState) => {
    const s = await api.tokens.setPrioritySlot(sid, slotIndex, slot);
    setTokenStates(p => ({ ...p, [sid]: s }));
  }, []);

  const cancelSession = useCallback(async (doctorId: string, date: string, session: string) => {
    await api.tokens.cancelSession(doctorId, date, session);
    const key = `${doctorId}_${date}_${session}`;
    setCancelled(p => p.includes(key) ? p : [...p, key]);
  }, []);

  const isSessionCancelled = useCallback((doctorId: string, date: string, session: string) =>
    cancelled.includes(`${doctorId}_${date}_${session}`), [cancelled]);

  const getStats = useCallback(() => ({
    totalHospitals: hospitals.length,
    totalDoctors:   doctors.length,
    totalPatients:  patients.length,
    totalBookings:  bookings.length,
    activeSessions: Object.values(tokenStates).filter(
      s => !s.isClosed && s.currentToken !== null
    ).length,
  }), [hospitals, doctors, patients, bookings, tokenStates]);

  const refreshFromStorage = useCallback(async () => {
    await loadCoreData(userRef.current, true);
    await Promise.all(
      Object.keys(tokenStates).map(sid =>
        api.tokens.getState(sid)
          .then(s => { if (s) setTokenStates(p => ({ ...p, [sid]: s })); })
          .catch(() => {})
      )
    );
  }, [tokenStates, loadCoreData]);

  const getPatientCredentials = useCallback(() => ({} as Record<string, { name: string; password: string }>), []);
  const getPatientNameIndex   = useCallback(() => ({} as Record<string, string>), []);
  const savePatientCredential = useCallback(() => {}, []);


  // ── Global Queue Notifications for all active bookings ──────────────────
  useEffect(() => {
    if (!user || user.role !== 'patient') return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    const canUseNotifications = () => {
      if (Capacitor.isNativePlatform()) return true;
      return Notification.permission === 'granted';
    };

    if (!Capacitor.isNativePlatform() && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const activeBookings = bookings.filter(b => b.status === 'confirmed' && b.paymentDone);
    if (!activeBookings.length) return;

    function vibrate(pattern: number | number[]) {
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(pattern);
        }
      } catch {
        // vibration is best-effort only — never let it break the app
      }
    }

    // IMPORTANT: `new Notification(...)` is not supported on Android Chrome —
    // it throws "Failed to construct 'Notification': Illegal constructor".
    // Android requires notifications to go through a Service Worker
    // registration instead. This mirrors the safe pattern already used in
    // useQueueNotifications.ts. Everything here is wrapped so a notification
    // failure can NEVER crash the app (this effect runs at the top of the
    // whole tree, above any page-level ErrorBoundary).
    async function notify(title: string, body: string, tag: string, vibratePattern: number[]) {
      if (!canUseNotifications()) return;

      try { vibrate(vibratePattern); } catch {}

      if (Capacitor.isNativePlatform()) {
        try {
          const { LocalNotifications } = await import("@capacitor/local-notifications");
          await LocalNotifications.requestPermissions();
          await LocalNotifications.schedule({
            notifications: [
              {
                id: Math.floor(Math.random() * 2147483647),
                title,
                body,
                extra: { link: "/patient/hospitals" },
              },
            ],
          });
        } catch (err) {
          console.error("[queue notifications] native local notification failed:", err);
        }
        return;
      }

      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, {
          body,
          icon: "/assets/Logo.jpg",
          badge: "/assets/Logo.jpg",
          tag,
          data: { link: "/patient/hospitals" },
        });
        return;
      } catch {
        // Service worker path may not be ready yet; fall back to browser notification.
      }

      try {
        new Notification(title, {
          body,
          icon: "/assets/Logo.jpg",
          badge: "/assets/Logo.jpg",
          tag,
          data: { link: "/patient/hospitals" },
        });
      } catch {
        // Browser notification is best-effort; never let it crash the store.
      }
    }

    for (const booking of activeBookings) {
      try {
        const state = tokenStates[booking.sessionId];
        if (!state) continue;
        const statuses = state.tokenStatuses ?? {};
        const myStatus = statuses[booking.tokenNumber];
        const nowSeeing = state.currentToken;

        // Previous token called - get ready
        if (nowSeeing !== null && nowSeeing === booking.tokenNumber - 1) {
          const key = `notif_prev_${booking.sessionId}_${booking.tokenNumber}`;
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, '1');
            void notify(
              'Doctor Booked - Get Ready!',
              `Token #${booking.tokenNumber} is next. Please stay ready.`,
              `prev-${booking.sessionId}-${booking.tokenNumber}`,
              [150, 80, 150]
            );
          }
        }

        // Your token is next (yellow)
        if (myStatus === 'yellow') {
          const key = `notif_yellow_${booking.sessionId}_${booking.tokenNumber}`;
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, '1');
            toast.success("🔔 You're Next!", {
              description: `Token #${booking.tokenNumber} — Dr. ${booking.doctorName} will call you soon!`,
              duration: 8000,
            });
            void notify(
              "Doctor Booked - You're Next! 🎉",
              `Token #${booking.tokenNumber} - Dr. ${booking.doctorName} will call you soon!`,
              `yellow-${booking.sessionId}-${booking.tokenNumber}`,
              [200, 100, 200]
            );
          }
        }

        // Your token is ongoing (orange)
        if (myStatus === 'orange') {
          const key = `notif_orange_${booking.sessionId}_${booking.tokenNumber}`;
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, '1');
            toast.success("🏥 You're Being Seen!", {
              description: 'Please go to the consultation room now!',
              duration: 6000,
            });
            void notify(
              'Your consultation is starting! 🏥',
              'Please go to the consultation room now.',
              `orange-${booking.sessionId}-${booking.tokenNumber}`,
              [500, 100, 500]
            );
          }
        }
      } catch (err) {
        // A problem with one booking's notification should never take down
        // the whole app or block notifications for the other bookings.
        console.error('[queue notifications] failed for booking', booking.id, err);
      }
    }
  }, [bookings, tokenStates, user]);

  const value: Store = {
    user, serverStatus, login, logout,
    hospitals, addHospital, updateHospital, updateHospitalPhoto, deleteHospital,
    doctors, addDoctor, updateDoctor, deleteDoctor,
    bookings, addBooking, addBookingToStore, getBookingsForPatient, getBookingsForSession,
    patients,
    tokenStates, getOrCreateTokenState, bookToken,
    regulateToken, completeCurrentToken, skipToken, completeSkippedToken,
    closeSession, setPrioritySlot, cancelSession, isSessionCancelled,
    getStats, notification, setNotification, hasNewPrescription, clearPrescriptionDot: () => setHasNewPrescription(false), refreshFromStorage,
    getPatientCredentials, getPatientNameIndex, savePatientCredential,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
