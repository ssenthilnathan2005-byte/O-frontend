import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useStore } from "@/context/StoreContext";
import { SESSION_TIMES } from "@/data/seed";
import { isLiveBookingStatus } from "@/lib/bookingStatus";

interface ActiveBooking {
  id: string;
  tokenNumber: number;
  sessionId: string;
  doctorName: string;
  hospitalName: string;
  session: string;
  date: string;
  avgMinutesPerPatient: number;
}

export default function TokenStatusBar() {
  const { user, bookings, doctors, hospitals } = useStore();
  const router = useRouter();
  const [activeBooking, setActiveBooking] = useState<ActiveBooking | null>(null);
  const [currentToken, setCurrentToken] = useState<number>(0);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  

  useEffect(() => {
    if (!user || user.role !== "patient") return;

    const today = new Date().toISOString().split("T")[0];
    const todayBooking = (bookings as any[]).find(
      (b) => b.patientId === user.id && b.date === today && isLiveBookingStatus(b.status)
    );
    if (!todayBooking) { setActiveBooking(null); return; }

    const doctor = (doctors as any[]).find((d) => d.id === todayBooking.doctorId);
    const hospital = (hospitals as any[]).find((h) => h.id === doctor?.hospitalId);

    setActiveBooking({
      id: todayBooking.id,
      tokenNumber: todayBooking.tokenNumber,
      sessionId: todayBooking.sessionId,
      doctorName: doctor?.name ?? "Doctor",
      hospitalName: hospital?.name ?? "Hospital",
      session: todayBooking.session,
      date: todayBooking.date,
      avgMinutesPerPatient: doctor?.avgMinutesPerPatient ?? 5,
    });
  }, [user, bookings, doctors, hospitals]);

  useEffect(() => {
    if (!activeBooking) return;
    let ws: WebSocket | null = null;

    function connect() {
      const wsUrl = (import.meta.env.VITE_WS_URL || "wss://api.doctorbooked.in")
        + `/ws?session=${activeBooking!.sessionId}`;
      ws = new WebSocket(wsUrl);
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "state_update" && data.state) {
            if (data.state.currentToken !== undefined && data.state.currentToken !== null) {
              setCurrentToken(Number(data.state.currentToken));
            }
            if (data.state.isClosed) {
              setActiveBooking(null);
            }
          }
        } catch {}
      };
    }

    connect();
    return () => ws?.close();
  }, [activeBooking?.sessionId]);

  if (!activeBooking) return null;

  // Only show after session has started
  const today = now.toISOString().split("T")[0];
  if (activeBooking.date !== today) return null;

  const doctor = (doctors as any[]).find((d: any) => d.id === activeBooking.sessionId.split("_")[0]);
  const customTimings = doctor?.sessionTimings;
  const sessionKey = activeBooking.session;
  const custom = customTimings?.[sessionKey];
  const times = custom ?? SESSION_TIMES[sessionKey];
  if (!times) return null;

  const [startH, startM] = times.start.split(":").map(Number);
  const sessionStart = new Date();
  sessionStart.setHours(startH, startM, 0, 0);
  const [endH, endM] = times.end.split(":").map(Number);
  const sessionEnd = new Date();
  sessionEnd.setHours(endH, endM, 0, 0);

  function formatCountdown(ms: number) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }

  const sessionStartsIn = Math.max(0, sessionStart.getTime() - now.getTime());
  const sessionEndsIn = Math.max(0, sessionEnd.getTime() - now.getTime());

  const tokensAhead = Math.max(0, activeBooking.tokenNumber - currentToken - 1);
  const waitMinutes = tokensAhead * activeBooking.avgMinutesPerPatient;
  const waitSeconds = Math.max(0, waitMinutes * 60);

  const isYourTurn = currentToken + 1 === activeBooking.tokenNumber;
  const isNow = currentToken === activeBooking.tokenNumber;
  const isPastSession = now >= sessionEnd;

  let bg = "bg-green-50 border-green-200";
  let textColor = "text-green-800";
  let subColor = "text-green-600";
  let dotColor = "bg-green-500";
  let mainText = `Token #${activeBooking.tokenNumber} · About ${formatCountdown(waitSeconds)} wait · ${tokensAhead} patient${tokensAhead !== 1 ? "s" : ""} ahead`;
  let timerText = `Estimated wait: ${formatCountdown(waitSeconds)}`;

  const isVisited = currentToken > activeBooking.tokenNumber;

  if (now < sessionStart) {
    bg = "bg-sky-50 border-sky-200";
    textColor = "text-sky-800";
    subColor = "text-sky-600";
    dotColor = "bg-sky-500";
    mainText = `Token #${activeBooking.tokenNumber} · Session starts in ${formatCountdown(sessionStartsIn)}`;
    timerText = `Session starts in ${formatCountdown(sessionStartsIn)}`;
  } else if (isPastSession) {
    bg = "bg-gray-50 border-gray-200";
    textColor = "text-gray-600";
    subColor = "text-gray-400";
    dotColor = "bg-gray-400";
    mainText = `Token #${activeBooking.tokenNumber} · Session ended · Thank you!`;
    timerText = `Session ended ${formatCountdown(sessionEndsIn)}`;
  }

  if (isVisited) {
    bg = "bg-gray-50 border-gray-200";
    textColor = "text-gray-600";
    subColor = "text-gray-400";
    dotColor = "bg-gray-400";
    mainText = `Token #${activeBooking.tokenNumber} · Visit complete · Thank you!`;
    timerText = "Visit complete";
  } else if (isNow) {
    bg = "bg-red-50 border-red-200";
    textColor = "text-red-800";
    subColor = "text-red-600";
    dotColor = "bg-red-500 animate-pulse";
    mainText = `Token #${activeBooking.tokenNumber} · Your turn now! · Please proceed`;
    timerText = "Your turn now";
  } else if (isYourTurn) {
    bg = "bg-orange-50 border-orange-200";
    textColor = "text-orange-800";
    subColor = "text-orange-600";
    dotColor = "bg-orange-500 animate-pulse";
    mainText = `Token #${activeBooking.tokenNumber} · 1 patient ahead · Get ready!`;
    timerText = "You are next";
  } else if (tokensAhead <= 2) {
    bg = "bg-amber-50 border-amber-200";
    textColor = "text-amber-800";
    subColor = "text-amber-600";
    dotColor = "bg-amber-500";
    mainText = `Token #${activeBooking.tokenNumber} · About ${formatCountdown(waitSeconds)} wait · ${tokensAhead} patients ahead`;
    timerText = `Estimated wait: ${formatCountdown(waitSeconds)}`;
  }

  const subText = `${activeBooking.hospitalName} · ${activeBooking.session.charAt(0).toUpperCase() + activeBooking.session.slice(1)} session · ${timerText} · Tap to track`;

  return (
    <div
      className={`w-full border-b ${bg} px-4 py-2 flex items-center gap-3 cursor-pointer`}
      onClick={() => router.navigate({ to: `/my-tokens/${activeBooking.id}` })}
    >
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${textColor}`}>{mainText}</p>
        <p className={`text-xs truncate ${subColor}`}>{subText}</p>
      </div>

    </div>
  );
}
