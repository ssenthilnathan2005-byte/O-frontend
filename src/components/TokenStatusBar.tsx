import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useStore } from "@/context/StoreContext";
import { SESSION_TIMES } from "@/data/seed";

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
  

  useEffect(() => {
    if (!user || user.role !== "patient") return;

    const today = new Date().toISOString().split("T")[0];
    const todayBooking = (bookings as any[]).find(
      (b) => b.date === today && (b.status === "confirmed" || b.status === "ongoing")
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
  const now = new Date();
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
  if (now < sessionStart) return null;

  const tokensAhead = Math.max(0, activeBooking.tokenNumber - currentToken - 1);
  const waitMinutes = tokensAhead * activeBooking.avgMinutesPerPatient;

  const isYourTurn = currentToken + 1 === activeBooking.tokenNumber;
  const isNow = currentToken === activeBooking.tokenNumber;

  let bg = "bg-green-50 border-green-200";
  let textColor = "text-green-800";
  let subColor = "text-green-600";
  let dotColor = "bg-green-500";
  let mainText = `Token #${activeBooking.tokenNumber} · About ${waitMinutes} min wait · ${tokensAhead} patient${tokensAhead !== 1 ? "s" : ""} ahead`;

  const isVisited = currentToken > activeBooking.tokenNumber;

  if (isVisited) {
    bg = "bg-gray-50 border-gray-200";
    textColor = "text-gray-600";
    subColor = "text-gray-400";
    dotColor = "bg-gray-400";
    mainText = `Token #${activeBooking.tokenNumber} · Visit complete · Thank you!`;
  } else if (isNow) {
    bg = "bg-red-50 border-red-200";
    textColor = "text-red-800";
    subColor = "text-red-600";
    dotColor = "bg-red-500 animate-pulse";
    mainText = `Token #${activeBooking.tokenNumber} · Your turn now! · Please proceed`;
  } else if (isYourTurn) {
    bg = "bg-orange-50 border-orange-200";
    textColor = "text-orange-800";
    subColor = "text-orange-600";
    dotColor = "bg-orange-500 animate-pulse";
    mainText = `Token #${activeBooking.tokenNumber} · 1 patient ahead · Get ready!`;
  } else if (tokensAhead <= 2) {
    bg = "bg-amber-50 border-amber-200";
    textColor = "text-amber-800";
    subColor = "text-amber-600";
    dotColor = "bg-amber-500";
    mainText = `Token #${activeBooking.tokenNumber} · About ${waitMinutes} min wait · ${tokensAhead} patients ahead`;
  }

  const subText = `${activeBooking.hospitalName} · ${activeBooking.session.charAt(0).toUpperCase() + activeBooking.session.slice(1)} session · Tap to track`;

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
