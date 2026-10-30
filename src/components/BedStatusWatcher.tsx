import { useEffect, useState } from "react";
import { BedDouble, CheckCircle2, XCircle } from "lucide-react";
import { bedBookings } from "../api";
import { useStore } from "../context/StoreContext";
import { useRouter } from "../router/RouterContext";
import { useLiveRefresh } from "../hooks/useLiveRefresh";

type Ev = { key: string; title: string; body: string; kind: "good" | "bad" | "info"; cta: string; path: string };

const fmt = (s?: string | null) =>
  s ? new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "";

// Watches the patient's bed requests and stays. When the hospital changes the status
// (approved, declined, admitted, discharged) a clear pop-up is shown. The last seen status
// of every request/stay is remembered on the device, so a change that happened while the
// app was closed is still announced the next time the app opens.
export default function BedStatusWatcher() {
  const { user } = useStore() as any;
  const { navigate } = useRouter();
  const [queue, setQueue] = useState<Ev[]>([]);
  const isPatient = !!user && user.role === "patient";
  const KEY = "db_bed_seen_" + String(user?.id || user?.phone || user?.email || "p");

  async function check() {
    if (!isPatient) return;
    const [s, r] = await Promise.all([bedBookings.myStays(), bedBookings.mine()]);
    if (!Array.isArray(s) || !Array.isArray(r)) return;

    const now: Record<string, string> = {};
    r.forEach((x: any) => { now["r:" + x.id] = String(x.status); });
    s.forEach((x: any) => { now["s:" + x.id] = String(x.status); });

    let prev: Record<string, string> | null = null;
    try { prev = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { prev = null; }
    try { localStorage.setItem(KEY, JSON.stringify(now)); } catch { /* ignore */ }
    if (!prev) return; // first run on this device: just remember, do not announce old items

    const evs: Ev[] = [];
    r.forEach((x: any) => {
      if (prev![("r:" + x.id)] === x.status) return;
      if (x.status === "confirmed") {
        const where = [x.bed_number ? "Bed " + x.bed_number : "a bed", x.ward_name].filter(Boolean).join(", ");
        evs.push({
          key: "r:" + x.id + ":confirmed", kind: "good",
          title: "Your bed is approved",
          body: `${x.hospital_name || "The hospital"} has reserved ${where} for you.` +
            (x.reserved_until ? ` Please arrive before ${fmt(x.reserved_until)} for admission.` : " You can go for admission now."),
          cta: "View bed details", path: "/patient/admission",
        });
      } else if (x.status === "rejected") {
        evs.push({
          key: "r:" + x.id + ":rejected", kind: "bad",
          title: "Bed request declined",
          body: `${x.hospital_name || "The hospital"} could not allot a bed. Please contact them or try another hospital.`,
          cta: "Find a hospital", path: "/patient/hospitals",
        });
      }
    });
    s.forEach((x: any) => {
      const before = prev![("s:" + x.id)];
      if (before === x.status) return;
      if (x.status === "admitted") {
        evs.push({
          key: "s:" + x.id + ":admitted", kind: "good",
          title: "You are admitted",
          body: `${x.hospital_name || "Hospital"}: ${x.bed_number ? "Bed " + x.bed_number : "bed assigned"}${x.ward ? ", " + x.ward : ""}.`,
          cta: "View my bed", path: "/patient/admission",
        });
      } else if (before === "admitted") {
        evs.push({
          key: "s:" + x.id + ":discharged", kind: "info",
          title: "You have been discharged",
          body: "Your bill and receipts are available in Bed Bookings & Receipts.",
          cta: "View receipts", path: "/patient/admission",
        });
      }
    });
    if (evs.length) setQueue((q) => [...q, ...evs.filter((e) => !q.some((o) => o.key === e.key))]);
  }

  useEffect(() => { if (isPatient) check().catch(() => {}); }, [isPatient, KEY]); // eslint-disable-line react-hooks/exhaustive-deps
  useLiveRefresh(check, 30000, isPatient);

  const ev = queue[0];
  useEffect(() => {
    if (ev && typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate([200, 100, 200]); } catch { /* ignore */ }
    }
  }, [ev?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isPatient || !ev) return null;
  const next = () => setQueue((q) => q.slice(1));
  const Icon = ev.kind === "bad" ? XCircle : ev.kind === "good" ? CheckCircle2 : BedDouble;
  const tone = ev.kind === "bad" ? "bg-red-50 text-red-600" : "bg-teal-50 text-teal-600";

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/45 p-4" role="alertdialog" aria-live="assertive">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl text-center space-y-3">
        <div className={"mx-auto w-14 h-14 rounded-full flex items-center justify-center " + tone}>
          <Icon className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-gray-900">{ev.title}</h3>
        <p className="text-sm text-gray-600">{ev.body}</p>
        {queue.length > 1 && <p className="text-[11px] text-gray-400">{queue.length - 1} more update{queue.length > 2 ? "s" : ""}</p>}
        <button
          type="button"
          onClick={() => { const p = ev.path; next(); navigate({ path: p } as any); }}
          className="w-full h-11 rounded-xl bg-teal-600 text-white text-sm font-semibold active:scale-[0.98]"
        >
          {ev.cta}
        </button>
        <button type="button" onClick={next} className="w-full h-10 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50">
          Close
        </button>
      </div>
    </div>
  );
}
