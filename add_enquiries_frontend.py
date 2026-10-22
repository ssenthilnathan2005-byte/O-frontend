"""Adds the 'Register your hospital / Contact us' form to the About page and an
Enquiries inbox to the founder (CTO) console. Run from the O-frontend repo root."""
import sys

def read(p):
    return open(p, encoding="utf-8").read()

def write(p, s):
    open(p, "w", encoding="utf-8", newline="").write(s)

def sub(s, old, new, label):
    if s.count(old) != 1:
        sys.exit(f"ABORT, nothing written for {label}: anchor found {s.count(old)} times")
    return s.replace(old, new)

for need in ("src/api.ts", "src/pages/AboutUsPage.tsx", "src/pages/cto/CtoDashboard.tsx"):
    try:
        read(need)
    except OSError:
        sys.exit(f"Missing {need}. Run from the O-frontend root (and apply add_about.py first).")

# ───────────────────────── api.ts ─────────────────────────
API = "src/api.ts"
s = read(API)
if "export const enquiries" in s:
    print("api.ts already patched")
else:
    anchor = '''export const cto = {
  overview: () => get<any>("/cto/overview"),
  supabase: () => get<any>("/cto/supabase"),
  vercel: () => get<any>("/cto/vercel"),
};'''
    add = '''

// ── Hospital enquiries (public form -> founder inbox) ─────────────────────────
export const enquiries = {
  submit: (b: {
    hospitalName: string; contactName: string; designation?: string; phone: string;
    email?: string; city?: string; hospitalSize?: string; message?: string; website?: string;
  }) => post<{ ok: boolean }>("/enquiries", b),
  list: (status?: string) =>
    get<any>("/enquiries" + (status ? `?status=${encodeURIComponent(status)}` : "")),
  update: (id: string, b: { status?: string; notes?: string }) =>
    patch<{ ok: boolean }>(`/enquiries/${encodeURIComponent(id)}`, b),
};'''
    s = sub(s, anchor, anchor + add, "api.ts")
    write(API, s)
    print("patched", API)

# ───────────────────── AboutUsPage.tsx ─────────────────────
ABOUT = "src/pages/AboutUsPage.tsx"
s = read(ABOUT)
if "function EnquiryForm" in s:
    print("AboutUsPage already patched")
else:
    s = sub(s, 'import { useRouter } from "../router/RouterContext";\n',
            'import { useRouter } from "../router/RouterContext";\n'
            'import { useState } from "react";\n'
            'import { Send, CheckCircle2 } from "lucide-react";\n'
            'import { enquiries } from "../api";\n', "about imports")

    section = r'''        {/* Contact / register your hospital */}
        <section id="contact" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:p-10">
          <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Register your hospital or contact us</h2>
          <p className="mt-2 text-gray-500 leading-relaxed">
            Want to bring your clinic or hospital onto Doctor Booked, or have a question? Share your details and our founders will get back to you.
          </p>
          <EnquiryForm />
        </section>

        {/* CTA */}'''
    s = sub(s, "        {/* CTA */}", section, "about section")

    comp = r'''

const SIZE_OPTIONS = ["Single-doctor clinic", "Clinic (2 to 5 doctors)", "Hospital up to 30 beds", "Hospital 30 to 100 beds", "Hospital 100+ beds"];
const FIELD = "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-base sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500";

function EnquiryForm() {
  const [f, setF] = useState({
    hospitalName: "", contactName: "", designation: "", phone: "",
    email: "", city: "", hospitalSize: "", message: "", website: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof f) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!f.hospitalName.trim()) return setErr("Please enter your hospital name.");
    if (!f.contactName.trim()) return setErr("Please enter your name.");
    if (f.phone.replace(/\D/g, "").length < 10) return setErr("Please enter a valid phone number.");
    setBusy(true);
    try {
      await enquiries.submit({
        hospitalName: f.hospitalName, contactName: f.contactName, designation: f.designation,
        phone: f.phone, email: f.email, city: f.city, hospitalSize: f.hospitalSize,
        message: f.message, website: f.website,
      });
      setDone(true);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not send your enquiry. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 rounded-2xl bg-teal-50 border border-teal-100 p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-teal-600 mx-auto" />
        <h3 className="mt-3 text-lg font-semibold text-gray-900">Thank you, we have received your details</h3>
        <p className="mt-1 text-sm text-gray-600">Our team will contact you on the phone number you shared.</p>
        <button
          type="button"
          onClick={() => { setDone(false); setF({ hospitalName: "", contactName: "", designation: "", phone: "", email: "", city: "", hospitalSize: "", message: "", website: "" }); }}
          className="mt-5 text-sm font-medium text-teal-700 hover:underline"
        >
          Send another enquiry
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Hospital / clinic name *</label>
        <input className={FIELD} value={f.hospitalName} onChange={set("hospitalName")} maxLength={150} placeholder="e.g. Sri Raja Hospital" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Your name *</label>
        <input className={FIELD} value={f.contactName} onChange={set("contactName")} maxLength={100} placeholder="Full name" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Your role</label>
        <input className={FIELD} value={f.designation} onChange={set("designation")} maxLength={80} placeholder="Owner, doctor, administrator..." />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Phone number *</label>
        <input className={FIELD} type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} maxLength={30} placeholder="10-digit mobile number" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
        <input className={FIELD} type="email" value={f.email} onChange={set("email")} maxLength={150} placeholder="Optional" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">City / town</label>
        <input className={FIELD} value={f.city} onChange={set("city")} maxLength={80} placeholder="e.g. Virudhunagar" />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-gray-600 mb-1">Hospital size</label>
        <select className={FIELD} value={f.hospitalSize} onChange={set("hospitalSize")}>
          <option value="">Select (optional)</option>
          {SIZE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-gray-600 mb-1">How can we help?</label>
        <textarea className={FIELD} rows={4} value={f.message} onChange={set("message")} maxLength={1500} placeholder="Tell us what you need, for example token booking, hospital management, labs or billing." />
      </div>

      {/* Honeypot: hidden from people, bots fill it in */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
        value={f.website} onChange={set("website")}
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />

      {err && <div className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{err}</div>}
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold px-8 py-3 shadow-lg shadow-teal-600/25 transition-colors w-full sm:w-auto"
        >
          <Send className="w-4 h-4" /> {busy ? "Sending..." : "Send enquiry"}
        </button>
      </div>
    </form>
  );
}
'''
    s = s.rstrip("\n") + "\n" + comp
    write(ABOUT, s)
    print("patched", ABOUT)

# ───────────────────── CtoDashboard.tsx ─────────────────────
CTO = "src/pages/cto/CtoDashboard.tsx"
s = read(CTO)
if "function EnquiriesSection" in s:
    print("CtoDashboard already patched")
else:
    s = sub(s, 'import { cto } from "../../api";',
            'import { cto, enquiries } from "../../api";\nimport { Inbox, Phone, MessageCircle, Mail } from "lucide-react";', "cto imports")

    comp = r'''
type Enquiry = {
  id: string; hospitalName: string; contactName: string; designation?: string | null; phone: string;
  email?: string | null; city?: string | null; hospitalSize?: string | null; message?: string | null;
  status: "new" | "contacted" | "closed"; notes?: string | null; createdAt: string;
};
const ENQ_BADGE: Record<string, string> = {
  new: "bg-teal-100 text-teal-800", contacted: "bg-amber-100 text-amber-800", closed: "bg-gray-200 text-gray-700",
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
    setBusy(true); setErr("");
    try { await enquiries.update(e.id, b); onChange(); }
    catch (x: any) { setErr(x?.message || "Could not save"); }
    finally { setBusy(false); }
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
          <span className={"rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize " + ENQ_BADGE[e.status]}>{e.status}</span>
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
        <div className="mt-3 text-sm text-gray-600">
          {[e.city, e.hospitalSize].filter(Boolean).join(" | ")}
        </div>
      )}
      {e.message && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{e.message}</p>}

      <textarea
        value={notes} onChange={(x) => setNotes(x.target.value)} rows={2} maxLength={1500}
        placeholder="Private notes (only you can see this)"
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

function EnquiriesSection() {
  const [filter, setFilter] = useState<"all" | "new" | "contacted" | "closed">("new");
  const [list, setList] = useState<Enquiry[]>([]);
  const [counts, setCounts] = useState({ new: 0, contacted: 0, closed: 0 });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await enquiries.list(filter === "all" ? undefined : filter);
      setList(r.enquiries || []); setCounts(r.counts || { new: 0, contacted: 0, closed: 0 }); setErr("");
    } catch (x: any) { setErr(x?.message || "Could not load enquiries"); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => {
    setLoading(true); load();
    const id = window.setInterval(load, 60000);
    return () => window.clearInterval(id);
  }, [load]);

  const tabs: { key: typeof filter; label: string; n?: number }[] = [
    { key: "new", label: "New", n: counts.new },
    { key: "contacted", label: "Contacted", n: counts.contacted },
    { key: "closed", label: "Closed", n: counts.closed },
    { key: "all", label: "All", n: counts.new + counts.contacted + counts.closed },
  ];

  return (
    <Section icon={<Inbox className="h-5 w-5" />} title={"Hospital enquiries" + (counts.new ? " (" + counts.new + " new)" : "")}>
      <div className="mb-3 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={"rounded-full border px-3 py-1 text-sm " + (filter === t.key ? "border-teal-600 bg-teal-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50")}>
            {t.label} {t.n ? "(" + t.n + ")" : ""}
          </button>
        ))}
      </div>
      {err && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      {loading ? <div className="text-sm text-gray-500">Loading...</div>
        : list.length === 0 ? <div className="rounded-xl border bg-white p-6 text-center text-sm text-gray-500">No enquiries here yet.</div>
        : <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{list.map((e) => <EnquiryCard key={e.id} e={e} onChange={load} />)}</div>}
    </Section>
  );
}
'''
    s = sub(s, "export default function CtoDashboard() {", comp.lstrip("\n") + "\nexport default function CtoDashboard() {", "cto component")
    s = sub(s, '        <Section icon={<Server className="h-5 w-5" />} title="Backend server">',
            '        <EnquiriesSection />\n\n        <Section icon={<Server className="h-5 w-5" />} title="Backend server">', "cto mount")
    write(CTO, s)
    print("patched", CTO)

print("done")
