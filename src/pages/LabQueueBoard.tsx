import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import * as api from "../api";
import type { LabBooking } from "../api";

const CHIP: Record<string, string> = {
  red: "bg-red-50 text-red-600 border-red-200",
  yellow: "bg-yellow-100 text-yellow-700 border-yellow-300",
  orange: "bg-orange-500 text-white border-orange-500",
  green: "bg-green-100 text-green-700 border-green-300",
  purple: "bg-purple-100 text-purple-700 border-purple-300",
};

function GroupCard({ labId, testId, date, session: sess, testName, bookings }: {
  labId: string; testId: string; date: string; session: string; testName: string; bookings: LabBooking[];
}) {
  const [session, setSession] = useState<api.LabSessionState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = () =>
      api.labs.getSession(labId, testId, date, sess).then((s) => { if (mounted) setSession(s); }).catch(() => {});
    load();
    const t = setInterval(load, 10_000);
    const close = api.connectTokenSocket(`${labId}_${testId}_${date}_${sess}`, (p: any) => {
      if (mounted && p?.type === "state_update" && p.state) setSession(p.state as api.LabSessionState);
    });
    return () => { mounted = false; clearInterval(t); close(); };
  }, [labId, testId, date, sess]);

  async function act(action: "call" | "complete" | "skip", token?: number) {
    setBusy(true);
    try {
      setSession(await api.labs.sessionAction(labId, testId, date, sess, action, token));
    } catch (err: any) {
      toast.error(err.message || "Queue update failed");
    } finally {
      setBusy(false);
    }
  }

  const statuses = session?.tokenStatuses ?? {};
  const nums = Object.keys(statuses).map(Number).sort((a, b) => a - b);
  const nameOf = (n: number) => bookings.find((b) => b.token_number === n)?.patient_name ?? "";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-semibold text-gray-900 text-sm">{testName}</p>
          <p className="text-xs text-gray-400">{date} · {api.labSessionLabel(sess)} · {nums.length} tokens</p>
        </div>
        <div className="flex gap-4 text-center">
          <div>
            <p className="text-[10px] uppercase text-gray-500 font-semibold">Now serving</p>
            <p className="text-lg font-extrabold text-orange-500">{session?.currentToken != null ? `#${session.currentToken}` : "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-gray-500 font-semibold">Next up</p>
            <p className="text-lg font-extrabold text-yellow-600">{session?.nextToken != null ? `#${session.nextToken}` : "—"}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <Button size="sm" disabled={busy} onClick={() => act("call")} className="bg-teal-500 hover:bg-teal-600 text-white">
          Call next
        </Button>
        <Button size="sm" variant="outline" disabled={busy || session?.currentToken == null} onClick={() => act("complete")}>
          Complete current
        </Button>
        <Button size="sm" variant="outline" disabled={busy || session?.currentToken == null} onClick={() => act("skip")}>
          Skip current
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {nums.map((n) => {
          const st = statuses[String(n)];
          const clickable = st !== "green" && st !== "orange";
          return (
            <button
              key={n}
              type="button"
              disabled={busy || !clickable}
              onClick={() => act("call", n)}
              title={clickable ? `Call #${n}` : ""}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${CHIP[st] || CHIP.red} ${clickable ? "hover:opacity-80" : "cursor-default"}`}
            >
              #{n} {nameOf(n) && <span className="font-normal">· {nameOf(n).split(" ")[0]}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function LabQueueBoard({ bookings }: { bookings: LabBooking[] }) {
  const cutoff = new Date(Date.now() - 86400000).toLocaleDateString("en-CA");
  const groups = new Map<string, LabBooking[]>();
  for (const b of bookings) {
    if (b.status === "cancelled" || b.token_number == null || b.slot_date < cutoff) continue;
    const k = `${b.lab_id}|${b.test_id}|${b.slot_date}|${b.slot_time}`;
    groups.set(k, [...(groups.get(k) ?? []), b]);
  }
  const list = Array.from(groups.values()).sort((a, b) => a[0].slot_date.localeCompare(b[0].slot_date) || (a[0].slot_time === b[0].slot_time ? 0 : a[0].slot_time === "morning" ? -1 : 1));
  if (list.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="font-semibold text-gray-900 text-sm mb-3">Live Queues</h2>
      {list.map((g) => (
        <GroupCard
          key={`${g[0].test_id}|${g[0].slot_date}|${g[0].slot_time}`}
          labId={g[0].lab_id}
          testId={g[0].test_id}
          date={g[0].slot_date}
          session={g[0].slot_time}
          testName={g[0].test_name || "Lab Test"}
          bookings={g}
        />
      ))}
    </div>
  );
}
