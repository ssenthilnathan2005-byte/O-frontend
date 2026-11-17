import { useEffect, useState } from "react";
import { toast } from "sonner";
import { patients } from "@/api";

type Req = { id: string; relation: string; created_at: string; requester_name: string };

export default function PhoneRequestsCard() {
  const [reqs, setReqs] = useState<Req[]>([]);
  const [busyId, setBusyId] = useState("");

  async function load() {
    try {
      const r = await patients.getPhoneRequests();
      setReqs(r.requests || []);
    } catch {}
  }

  useEffect(() => { load(); }, []);

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

  if (reqs.length === 0) return null;

  return (
    <div className="border border-amber-300 bg-amber-50 rounded-xl p-3 mb-3">
      <p className="text-sm font-semibold text-amber-800 mb-2">Phone number requests</p>
      {reqs.map(r => (
        <div key={r.id} className="bg-white rounded-lg p-3 mb-2 last:mb-0 border border-amber-200">
          <p className="text-sm text-gray-800">
            <span className="font-semibold">{r.requester_name}</span> wants to use your phone number on their account.
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Relation they selected: {r.relation || "Not given"}</p>
          <div className="flex gap-2 mt-2">
            <button type="button" disabled={busyId === r.id} onClick={() => decide(r.id, true)}
              className="flex-1 h-9 bg-teal-600 hover:bg-teal-700 text-white rounded-full text-sm font-semibold disabled:opacity-60">
              Approve
            </button>
            <button type="button" disabled={busyId === r.id} onClick={() => decide(r.id, false)}
              className="flex-1 h-9 border border-red-400 text-red-600 hover:bg-red-50 rounded-full text-sm font-semibold disabled:opacity-60">
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
