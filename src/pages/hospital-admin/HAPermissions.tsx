import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ClipboardList, FlaskConical, HeartPulse, Loader2, Pill, Save, ShieldCheck, Stethoscope, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getToken } from "../../api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

async function call(path: string, method = "GET", body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || "Request failed");
  return data;
}

const ROLE_META: Record<string, { label: string; blurb: string; icon: LucideIcon; hrType: string }> = {
  doctor: { label: "Doctor", blurb: "Consultation and prescribing", icon: Stethoscope, hrType: "doctor" },
  front_office: { label: "Front Desk", blurb: "Check-in, fees and admissions", icon: ClipboardList, hrType: "front_office" },
  pharmacy: { label: "Pharmacy Staff", blurb: "Prescription queue and stock", icon: Pill, hrType: "pharmacy" },
  nurse: { label: "Nurse", blurb: "Wards, beds and vitals", icon: HeartPulse, hrType: "nurse" },
  hospital_lab: { label: "Lab Technician", blurb: "Lab orders and reports", icon: FlaskConical, hrType: "lab" },
};

const MODULE_META: Record<string, { label: string; hint: string; group: string; sensitive?: boolean }> = {
  live_patients: { label: "Live Patients", hint: "Today's OPD queue and bookings", group: "Clinical" },
  all_patients: { label: "All Patients", hint: "Full patient records and history", group: "Clinical" },
  beds_wards: { label: "Beds & Wards", hint: "View beds, admit and discharge, cleaning", group: "Clinical" },
  vitals: { label: "Vitals & Notes", hint: "Record vitals and nursing notes", group: "Clinical" },
  ipd: { label: "IPD / Inward", hint: "Admitted patients and discharge", group: "Clinical" },
  lab: { label: "Laboratory", hint: "Lab tests and orders", group: "Clinical" },
  pharmacy: { label: "Pharmacy", hint: "Pharmacy operations and sales", group: "Pharmacy & Stock" },
  inventory: { label: "Inventory", hint: "Stock items and transactions", group: "Pharmacy & Stock" },
  revenue: { label: "Revenue & KPIs", hint: "Hospital-wide revenue dashboard", group: "Finance", sensitive: true },
  billing: { label: "Billing", hint: "Billing and collections", group: "Finance", sensitive: true },
  hr: { label: "HR / Staff", hint: "Staff list, salary and employment", group: "Administration", sensitive: true },
  attendance: { label: "Attendance", hint: "Staff attendance records", group: "Administration" },
};
const GROUP_ORDER = ["Clinical", "Pharmacy & Stock", "Finance", "Administration"];

// Sub-permissions that only exist under IPD / Inward
const IPD_SUBS: { key: string; label: string; hint: string; group?: string }[] = [
  { key: "ipd_bed_requests", label: "Online Bed Requests & Bed Charges", hint: "Online bed requests and the bed charge per day" },
  { key: "ipd_collections", label: "IPD Collections", hint: "Collected today, this month, outstanding and patient balances" },
  { key: "ipd_patient_ops", group: "Inward Patients", label: "Patient Operations", hint: "Edit, transfer, discharge and the other patient actions" },
  { key: "ipd_patient_billing", group: "Inward Patients", label: "Billing", hint: "Open patient bills, add charges and take payments" },
];
const IPD_SUB_KEYS = IPD_SUBS.map(s => s.key);

type StaffRow = { name: string; code: string };

export default function HAPermissions() {
  const [roles, setRoles] = useState<string[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [saved, setSaved] = useState<Record<string, string[]>>({});
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [staff, setStaff] = useState<Record<string, StaffRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await call("/permissions");
        setRoles(d.roles);
        setModules(d.modules);
        setSaved(d.permissions);
        setDraft(JSON.parse(JSON.stringify(d.permissions)));
      } catch (e: any) { toast.error(e.message || "Could not load permissions"); }
      finally { setLoading(false); }
      try {
        const rows = await call("/hr");
        if (Array.isArray(rows)) {
          const out: Record<string, StaffRow[]> = {};
          for (const [role, meta] of Object.entries(ROLE_META)) {
            out[role] = rows
              .filter((r: any) => r.login_type === meta.hrType && r.login_code)
              .map((r: any) => ({ name: r.name, code: r.login_code }));
          }
          setStaff(out);
        }
      } catch { /* login list is optional */ }
    })();
  }, []);

  const groups = useMemo(() => {
    const g: Record<string, string[]> = {};
    for (const m of modules.filter(x => !IPD_SUB_KEYS.includes(x))) (g[MODULE_META[m]?.group || "Other"] ||= []).push(m);
    return GROUP_ORDER.filter(k => g[k]).map(k => [k, g[k]] as const)
      .concat(Object.keys(g).filter(k => !GROUP_ORDER.includes(k)).map(k => [k, g[k]] as const));
  }, [modules]);

  const isDirty = (role: string) =>
    [...(draft[role] || [])].sort().join("|") !== [...(saved[role] || [])].sort().join("|");

  function toggle(role: string, mod: string) {
    setDraft(d => {
      let cur = d[role] || [];
      if (mod === "ipd") {
        // ticking IPD / Inward ticks all three sub-permissions; unticking clears them
        cur = cur.includes("ipd")
          ? cur.filter(x => x !== "ipd" && !IPD_SUB_KEYS.includes(x))
          : [...cur.filter(x => !IPD_SUB_KEYS.includes(x)), "ipd", ...IPD_SUB_KEYS];
      } else if (IPD_SUB_KEYS.includes(mod)) {
        // an older saved IPD / Inward (no sub-permissions yet) means all three
        if (cur.includes("ipd") && !IPD_SUB_KEYS.some(k => cur.includes(k))) cur = [...cur, ...IPD_SUB_KEYS];
        cur = cur.includes(mod) ? cur.filter(x => x !== mod) : [...cur, mod];
        // with all three cleared, IPD / Inward itself is off
        if (!IPD_SUB_KEYS.some(k => cur.includes(k))) cur = cur.filter(x => x !== "ipd");
      } else {
        cur = cur.includes(mod) ? cur.filter(x => x !== mod) : [...cur, mod];
      }
      return { ...d, [role]: cur };
    });
  }
  function setAll(role: string, on: boolean) {
    setDraft(d => ({ ...d, [role]: on ? [...modules] : [] }));
  }

  async function save(role: string) {
    setSavingRole(role);
    try {
      const r = await call("/permissions/" + role, "PUT", { modules: draft[role] || [] });
      setSaved(s => ({ ...s, [role]: r.modules }));
      setDraft(d => ({ ...d, [role]: r.modules }));
      toast.success(ROLE_META[role]?.label + " permissions saved");
    } catch (e: any) { toast.error(e.message || "Save failed"); }
    finally { setSavingRole(null); }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>;
  }

  return (
    <div className="w-full p-4 md:p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Permissions</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Choose what each staff login can see and operate. Changes apply to everyone in that role at your hospital, within about 15 seconds.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {roles.map(role => {
          const meta = ROLE_META[role] || { label: role, blurb: "", icon: ShieldCheck, hrType: role };
          const Icon = meta.icon;
          const on = draft[role] || [];
          const dirty = isDirty(role);
          const logins = staff[role] || [];
          return (
            <section key={role} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <header className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-teal-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-gray-900">{meta.label}</h2>
                  <p className="text-xs text-gray-500">{meta.blurb}</p>
                </div>
                <span className="text-xs font-medium text-teal-700 bg-teal-50 rounded-full px-2.5 py-1 shrink-0">
                  {on.filter(x => !IPD_SUB_KEYS.includes(x)).length} of {modules.filter(x => !IPD_SUB_KEYS.includes(x)).length} allowed
                </span>
              </header>

              {logins.length > 0 && (
                <div className="px-5 pt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-gray-400 mr-1">Logins</span>
                  {logins.map(l => (
                    <span key={l.code} className="text-xs bg-gray-50 border border-gray-200 rounded-md px-2 py-0.5 text-gray-600">
                      {l.name} <span className="font-mono text-gray-400">{l.code}</span>
                    </span>
                  ))}
                </div>
              )}

              <div className="px-5 py-4 space-y-4">
                {groups.map(([group, mods]) => (
                  <div key={group}>
                    <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">{group}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 grid-flow-dense items-start gap-2">
                      {mods.map(m => {
                        const mm = MODULE_META[m] || { label: m, hint: "" };
                        const checked = on.includes(m);
                        return (
                          <Fragment key={m}>
                          <label
                            className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
                              checked ? "border-teal-300 bg-teal-50/60" : "border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(role, m)}
                              className="mt-0.5 h-4 w-4 accent-teal-600 shrink-0"
                            />
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                                {mm.label}
                                {mm.sensitive && (
                                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1">Sensitive</span>
                                )}
                              </span>
                              <span className="block text-xs text-gray-500 leading-snug">{mm.hint}</span>
                            </span>
                          </label>
                          {m === "ipd" && checked && (() => {
                            const renderSub = (sub: (typeof IPD_SUBS)[number]) => {
                              const subOn = on.includes(sub.key) || !IPD_SUB_KEYS.some(k => on.includes(k));
                              return (
                                <label
                                  key={sub.key}
                                  className={`flex items-start gap-2.5 rounded-lg border bg-white px-3 py-2.5 cursor-pointer transition-colors ${
                                    subOn ? "border-teal-300 shadow-sm" : "border-gray-200 hover:border-gray-300"
                                  }`}
                                >
                                  <input type="checkbox" checked={subOn} onChange={() => toggle(role, sub.key)} className="mt-0.5 h-4 w-4 accent-teal-600 shrink-0" />
                                  <span className="min-w-0">
                                    <span className="block text-sm font-medium text-gray-900">{sub.label}</span>
                                    <span className="block text-xs text-gray-500 leading-snug">{sub.hint}</span>
                                  </span>
                                </label>
                              );
                            };
                            const plain = IPD_SUBS.filter(x => !x.group);
                            const groupNames = Array.from(new Set(IPD_SUBS.filter(x => x.group).map(x => x.group as string)));
                            return (
                              <div className="sm:col-span-2 rounded-xl border border-teal-200 bg-teal-50/40 p-3.5">
                                <div className="mb-3 flex flex-wrap items-baseline gap-x-2">
                                  <p className="text-sm font-semibold text-gray-900">IPD / Inward access</p>
                                  <p className="text-xs text-gray-500">Choose what this role can open inside IPD / Inward</p>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">{plain.map(renderSub)}</div>
                                {groupNames.map(g => (
                                  <div key={g} className="mt-3.5">
                                    <p className="mb-1.5 text-xs font-semibold text-gray-700">{g}</p>
                                    <div className="grid gap-2 sm:grid-cols-2">{IPD_SUBS.filter(x => x.group === g).map(renderSub)}</div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                          </Fragment>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <footer className="px-5 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center gap-2">
                <button type="button" onClick={() => setAll(role, true)} className="text-xs text-gray-600 hover:text-teal-700">Select all</button>
                <span className="text-gray-300">|</span>
                <button type="button" onClick={() => setAll(role, false)} className="text-xs text-gray-600 hover:text-teal-700">Clear all</button>
                <div className="flex-1" />
                {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
                <Button size="sm" onClick={() => save(role)} disabled={!dirty || savingRole === role}>
                  {savingRole === role ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1.5" />Save</>}
                </Button>
              </footer>
            </section>
          );
        })}
      </div>
    </div>
  );
}
