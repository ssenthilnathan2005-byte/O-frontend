import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getToken, patients } from "@/api";

type Req = { id: string; relation: string; created_at: string; requester_name: string };

export default function PhoneRequestPopup() {
  const [reqs, setReqs] = useState<Req[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [busyId, setBusyId] = useState("");
  const busy = useRef(false);

  async function load() {
    if (busy.current || !getToken()) return;
    busy.current = true;
    try {
      const r = await patients.getPhoneRequests();
      setReqs(r.requests || []);
    } catch {
      // ignore: not a patient, offline, or session expired
    } finally {
      busy.current = false;
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", load);
    };
  }, []);

  async function decide(id: string, approve: boolean) {
    setBusyId(id);
    try {
      await patients.decidePhoneRequest(id, approve);
      toast.success(approve ? "Approved" : "Rejected");
      setReqs(list => list.filter(x => x.id !== id));
    } catch (err: any) {
      toast.error(err?.message || "Could not save your answer");
    } finally {
      setBusyId("");
    }
  }

  const current = reqs.find(r => !dismissed.includes(r.id));
  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-xl">
        <p className="text-base font-bold text-gray-900 mb-1">Phone number request</p>
        <p className="text-sm text-gray-700">
          <span className="font-semibold">{current.requester_name}</span> wants to use your phone number on their account.
        </p>
        <p className="text-xs text-gray-500 mt-1">Relation they selected: {current.relation || "Not given"}</p>
        <p className="text-xs text-gray-500 mt-2">Approve only if you know this person. They will get their own separate ID.</p>
        <div className="flex gap-2 mt-4">
          <button type="button" disabled={busyId === current.id} onClick={() => decide(current.id, true)}
            className="flex-1 h-10 bg-teal-600 hover:bg-teal-700 text-white rounded-full text-sm font-semibold disabled:opacity-60">
            Approve
          </button>
          <button type="button" disabled={busyId === current.id} onClick={() => decide(current.id, false)}
            className="flex-1 h-10 border border-red-400 text-red-600 hover:bg-red-50 rounded-full text-sm font-semibold disabled:opacity-60">
            Reject
          </button>
        </div>
        <button type="button" onClick={() => setDismissed(d => [...d, current.id])}
          className="w-full mt-2 text-xs text-gray-500 hover:text-gray-700 py-1">
          Decide later
        </button>
        {reqs.length > 1 && <p className="text-[11px] text-gray-400 text-center mt-1">{reqs.length - 1} more waiting</p>}
      </div>
    </div>
  );
}
