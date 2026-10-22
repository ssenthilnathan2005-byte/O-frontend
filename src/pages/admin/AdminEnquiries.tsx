import { Inbox, Mail, MessageCircle, Phone, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { enquiries } from "../../api";

type Enquiry = {
  id: string; hospitalName: string; contactName: string; designation?: string | null; phone: string;
  email?: string | null; city?: string | null; hospitalSize?: string | null; message?: string | null;
  status: "new" | "contacted" | "closed"; notes?: string | null; createdAt: string;
};

const BADGE: Record<string, string> = {
  new: "bg-teal-100 text-teal-800",
  contacted: "bg-amber-100 text-amber-800",
  closed: "bg-gray-200 text-gray-700",
};

function waLink(phone: string) {
  let d = phone.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = "91" + d;
  return "https://wa.me/" + d;
}

function EnquiryCard({ e, onChange }: { e: Enquiry; onChange: () => void }) {
  const [notes, setNotes] = useState(e.notes || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save(b: { status?: string; notes?: string }) {
    setBusy(true);
    setErr("");
    try {
      await enquiries.update(e.id, b);
      onChange();
    } catch (x: any) {
      setErr(x?.message || "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-base font-semibold text-gray-900">{e.hospitalName}</div>
          <div className="text-sm text-gray-600">
            {e.contactName}{e.designation ? " (" + e.designation + ")" : ""}
          </div>
        </div>
        <div className="text-right">
          <span className={"rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize " + BADGE[e.status]}>{e.status}</span>
          <div className="mt-1 text-xs text-gray-400">{new Date(e.createdAt).toLocaleString()}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <a href={"tel:" + e.phone} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 font-medium text-white hover:bg-teal-700">
          <Phone className="h-4 w-4" /> {e.phone}
        </a>
        <a href={waLink(e.phone)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50">
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
        {e.email && (
          <a href={"mailto:" + e.email} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50">
            <Mail className="h-4 w-4" /> {e.email}
          </a>
        )}
      </div>

      {(e.city || e.hospitalSize) && (
        <div className="mt-3 text-sm text-gray-600">{[e.city, e.hospitalSize].filter(Boolean).join(" | ")}</div>
      )}
      {e.message && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{e.message}</p>}

      <textarea
        value={notes}
        onChange={(x) => setNotes(x.target.value)}
        rows={2}
        maxLength={1500}
        placeholder="Private notes (only admins can see this)"
        className="mt-3 w-full rounded-lg border border-gray-200 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        {notes !== (e.notes || "") && (
          <button disabled={busy} onClick={() => save({ notes })} className="rounded-lg border px-3 py-1 hover:bg-gray-50">Save note</button>
        )}
        {(["new", "contacted", "closed"] as const).filter((s) => s !== e.status).map((s) => (
          <button key={s} disabled={busy} onClick={() => save({ status: s })} className="rounded-lg border px-3 py-1 capitalize hover:bg-gray-50">
            Mark {s}
          </button>
        ))}
        {err && <span className="text-red-600">{err}</span>}
      </div>
    </div>
  );
}

export default function AdminEnquiries() {
  const [filter, setFilter] = useState<"all" | "new" | "contacted" | "closed">("new");
  const [list, setList] = useState<Enquiry[]>([]);
  const [counts, setCounts] = useState({ new: 0, contacted: 0, closed: 0 });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await enquiries.list(filter === "all" ? undefined : filter);
      setList(r.enquiries || []);
      setCounts(r.counts || { new: 0, contacted: 0, closed: 0 });
      setErr("");
    } catch (x: any) {
      setErr(x?.message || "Could not load enquiries");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    load();
    const id = window.setInterval(load, 60000);
    return () => window.clearInterval(id);
  }, [load]);

  const tabs: { key: typeof filter; label: string; n: number }[] = [
    { key: "new", label: "New", n: counts.new },
    { key: "contacted", label: "Contacted", n: counts.contacted },
    { key: "closed", label: "Closed", n: counts.closed },
    { key: "all", label: "All", n: counts.new + counts.contacted + counts.closed },
  ];

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Inbox className="h-6 w-6" /> Hospital Enquiries
          </h1>
          <p className="mt-1 text-muted-foreground">People who contacted us from the About page</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-sm hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={"rounded-full border px-3 py-1 text-sm " + (filter === t.key ? "border-teal-600 bg-teal-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50")}
          >
            {t.label} {t.n ? "(" + t.n + ")" : ""}
          </button>
        ))}
      </div>

      {err && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      {loading ? (
        <div className="text-sm text-gray-500">Loading...</div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border bg-white p-6 text-center text-sm text-gray-500">No enquiries here yet.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {list.map((e) => <EnquiryCard key={e.id} e={e} onChange={load} />)}
        </div>
      )}
    </div>
  );
}
