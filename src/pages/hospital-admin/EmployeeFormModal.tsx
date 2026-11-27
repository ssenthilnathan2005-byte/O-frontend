import { useEffect, useState } from "react";
import { X, Upload, Check, Ban, Trash2, Eye, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getToken } from "../../api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

const ROLE_OPTIONS = [
  { v: "doctor", l: "Doctor" },
  { v: "nurse", l: "Nurse" },
  { v: "receptionist", l: "Front Office" },
  { v: "pharmacist", l: "Pharmacist" },
  { v: "lab_technician", l: "Lab Technician" },
  { v: "housekeeping", l: "Housekeeping" },
  { v: "maintenance", l: "Maintenance" },
  { v: "security", l: "Security" },
  { v: "accountant", l: "Accountant" },
  { v: "other", l: "Other" },
];
const LOGIN_ROLES = ["doctor", "nurse", "receptionist", "pharmacist", "lab_technician"];
const SHIFTS = ["morning", "afternoon", "evening", "night"];
const DOC_TYPES: [string, string][] = [
  ["educational", "Educational certificate"],
  ["registration", "Professional registration certificate"],
  ["experience", "Experience certificate"],
  ["id_proof", "ID proof"],
  ["other", "Other"],
];
const docTypeLabel = (t: string) => (DOC_TYPES.find(x => x[0] === t) || ["", t])[1];

async function api(path: string, method = "GET", body?: any, form?: FormData) {
  const headers: Record<string, string> = { Authorization: `Bearer ${getToken()}` };
  if (!form) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method, headers, body: form ? form : body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* empty body */ }
  return { ok: res.ok, status: res.status, data };
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-600 mb-1 block">{label}</label>
      {children}
    </div>
  );
}
function Section({ title, children }: { title: string; children: any }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-teal-700 border-b pb-1">{title}</h3>
      {children}
    </div>
  );
}
const selectCls = "w-full border rounded-md px-3 py-2 text-sm bg-white";

type Props = { editing?: any; staffList: any[]; onClose: () => void; onSaved: () => void };

export default function EmployeeFormModal({ editing, staffList, onClose, onSaved }: Props) {
  const e = editing || {};
  const hasLogin = !!e.login_id;

  const [f, setF] = useState({
    name: e.name || "", dateOfBirth: e.date_of_birth || "", gender: e.gender || "",
    phone: e.phone || "", emergencyContactPhone: e.emergency_contact_phone || "", email: e.email || "", address: e.address || "",
    employeeId: e.employee_id || "", department: e.department || "", designation: e.designation || "",
    qualification: e.qualification || "", experience: e.experience || "", joinDate: e.join_date || "",
    employmentType: e.employment_type || "",
    role: e.role || "", shifts: (Array.isArray(e.shifts) ? e.shifts : []) as string[],
    salary: e.salary != null ? String(e.salary) : "", reportingManagerId: e.reporting_manager_id || "", notes: e.notes || "",
  });
  const [active, setActive] = useState<boolean>(editing ? e.is_active === 1 : true);
  const [wantLogin, setWantLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [creds, setCreds] = useState<{ code: string; tempPassword: string | null; type: string } | null>(null);

  // file storage (photo + certificates) - only active once the server has Supabase Storage connected
  const [storageOn, setStorageOn] = useState(false);
  const [docs, setDocs] = useState<any[]>([]);
  const [docType, setDocType] = useState("educational");
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));
  const canLogin = LOGIN_ROLES.includes(f.role);

  useEffect(() => {
    api("/employees/capabilities").then(r => setStorageOn(!!(r.ok && r.data && r.data.storage)));
  }, []);
  useEffect(() => {
    if (!storageOn || !editing) return;
    loadDocs();
    if (e.photo_path) api(`/employees/${editing.id}/photo-url`).then(r => setPhotoUrl(r.ok ? r.data.url : null));
  }, [storageOn]);

  async function loadDocs() {
    const r = await api(`/employees/${editing.id}/documents`);
    if (r.ok && Array.isArray(r.data)) setDocs(r.data);
  }
  async function uploadDocs(files: FileList | null) {
    if (!files || !files.length) return;
    const fd = new FormData();
    fd.append("docType", docType);
    Array.from(files).forEach(x => fd.append("files", x));
    setUploading(true);
    const r = await api(`/employees/${editing.id}/documents`, "POST", undefined, fd);
    setUploading(false);
    if (!r.ok) { toast.error(r.data?.error || "Upload failed"); return; }
    toast.success("Uploaded");
    loadDocs();
  }
  async function uploadPhoto(files: FileList | null) {
    if (!files || !files[0]) return;
    const fd = new FormData();
    fd.append("photo", files[0]);
    setUploading(true);
    const r = await api(`/employees/${editing.id}/photo`, "POST", undefined, fd);
    setUploading(false);
    if (!r.ok) { toast.error(r.data?.error || "Upload failed"); return; }
    const u = await api(`/employees/${editing.id}/photo-url`);
    setPhotoUrl(u.ok ? u.data.url : null);
    toast.success("Photo saved");
    onSaved();
  }
  async function viewDoc(d: any) {
    const r = await api(`/employees/${editing.id}/documents/${d.id}/url`);
    if (r.ok && r.data.url) window.open(r.data.url, "_blank", "noopener");
    else toast.error(r.data?.error || "Could not open the file");
  }
  async function setStatus(d: any, s: string) {
    const r = await api(`/employees/${editing.id}/documents/${d.id}`, "PATCH", { verificationStatus: s });
    if (!r.ok) { toast.error(r.data?.error || "Could not update"); return; }
    loadDocs();
  }
  async function delDoc(d: any) {
    if (!confirm("Delete this document?")) return;
    const r = await api(`/employees/${editing.id}/documents/${d.id}`, "DELETE");
    if (!r.ok) { toast.error(r.data?.error || "Could not delete"); return; }
    loadDocs();
  }

  async function save() {
    setBusy(true); setErr("");
    try {
      const body: any = {
        name: f.name, dateOfBirth: f.dateOfBirth, gender: f.gender, phone: f.phone,
        emergencyContactPhone: f.emergencyContactPhone, email: f.email, address: f.address,
        employeeId: f.employeeId, department: f.department, designation: f.designation,
        qualification: f.qualification, experience: f.experience, joinDate: f.joinDate,
        employmentType: f.employmentType, shifts: f.shifts, salary: f.salary,
        reportingManagerId: f.reportingManagerId, notes: f.notes, isActive: active,
      };
      if (!hasLogin) body.role = f.role;
      let created: any = null;
      if (!editing) {
        body.createLogin = wantLogin && canLogin;
        body.password = password;
        const r = await api("/employees", "POST", body);
        if (!r.ok) { setErr(r.data?.error || "Could not save the employee"); return; }
        created = r.data.login;
      } else {
        const r = await api(`/employees/${editing.id}`, "PATCH", body);
        if (!r.ok) { setErr(r.data?.error || "Could not save the employee"); return; }
        if (!hasLogin && wantLogin && canLogin) {
          const l = await api(`/employees/${editing.id}/login`, "POST", { role: f.role, password });
          if (!l.ok) { setErr("Details saved, but the login was not created: " + (l.data?.error || "error")); onSaved(); return; }
          created = l.data.login;
        }
      }
      toast.success(editing ? "Employee updated" : "Employee added");
      onSaved();
      if (created) setCreds({ code: created.code, tempPassword: created.tempPassword, type: created.type });
      else onClose();
    } catch {
      setErr("Could not reach the server. Please try again.");
    } finally { setBusy(false); }
  }

  if (creds) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
          <h2 className="font-semibold text-lg">Login created</h2>
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Login ID</span>
              <span className="font-mono font-semibold">{creds.code}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Password</span>
              {creds.tempPassword
                ? <span className="font-mono font-semibold">{creds.tempPassword}</span>
                : <span className="text-muted-foreground">the one you set</span>}
            </div>
          </div>
          {creds.tempPassword && (
            <p className="text-xs text-amber-700">Copy this temporary password now. It is shown only once; you can read it later in Password Management.</p>
          )}
          <div className="flex gap-3 justify-end">
            <button onClick={() => { navigator.clipboard?.writeText(`Login ID: ${creds.code}${creds.tempPassword ? "\nPassword: " + creds.tempPassword : ""}`); toast.success("Copied"); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border hover:bg-gray-50"><Copy className="w-4 h-4" /> Copy</button>
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium">Done</button>
          </div>
        </div>
      </div>
    );
  }

  const managers = (staffList || []).filter(s => s.id !== (editing && editing.id) && s.is_active === 1);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-semibold text-lg">{editing ? "Edit Employee" : "Add New Employee"}</h2>
            <p className="text-xs text-muted-foreground">Every field is optional. You can complete the profile any time.</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* 1. Personal */}
          <Section title="1. Personal Details">
            {editing ? (
              storageOn ? (
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-muted overflow-hidden flex items-center justify-center text-xs text-muted-foreground">
                    {photoUrl ? <img src={photoUrl} alt="" className="w-full h-full object-cover" /> : "No photo"}
                  </div>
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border hover:bg-gray-50 cursor-pointer">
                    <Upload className="w-4 h-4" /> {photoUrl ? "Replace photo" : "Upload photo"}
                    <input type="file" accept="image/*" className="hidden" disabled={uploading}
                      onChange={ev => { uploadPhoto(ev.target.files); ev.target.value = ""; }} />
                  </label>
                </div>
              ) : <p className="text-xs text-muted-foreground">Photo upload will be available once file storage is connected.</p>
            ) : (
              <p className="text-xs text-muted-foreground">{storageOn ? "Save the employee first, then add the photo." : "Photo upload will be available once file storage is connected."}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Full Name"><Input placeholder="Full name" value={f.name} onChange={ev => set("name", ev.target.value)} /></Field>
              <Field label="Date of Birth"><Input type="date" value={f.dateOfBirth} onChange={ev => set("dateOfBirth", ev.target.value)} /></Field>
              <Field label="Gender">
                <select className={selectCls} value={f.gender} onChange={ev => set("gender", ev.target.value)}>
                  <option value="">-</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                </select>
              </Field>
              <Field label="Mobile Number"><Input placeholder="Mobile number" value={f.phone} onChange={ev => set("phone", ev.target.value)} /></Field>
              <Field label="Emergency Contact Number"><Input placeholder="Emergency contact" value={f.emergencyContactPhone} onChange={ev => set("emergencyContactPhone", ev.target.value)} /></Field>
              <Field label="Email"><Input placeholder="Email address" value={f.email} onChange={ev => set("email", ev.target.value)} /></Field>
            </div>
            <Field label="Address">
              <textarea rows={2} value={f.address} onChange={ev => set("address", ev.target.value)} placeholder="Address"
                className="w-full border rounded-md px-3 py-2 text-sm bg-white resize-none" />
            </Field>
          </Section>

          {/* 2. Job */}
          <Section title="2. Job Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Employee ID"><Input placeholder="e.g. 101" value={f.employeeId} onChange={ev => set("employeeId", ev.target.value)} /></Field>
              <Field label="Department"><Input placeholder="e.g. Cardiology, Emergency" value={f.department} onChange={ev => set("department", ev.target.value)} /></Field>
              <Field label="Designation"><Input placeholder="e.g. Senior Nurse" value={f.designation} onChange={ev => set("designation", ev.target.value)} /></Field>
              <Field label="Qualification"><Input placeholder="e.g. B.Sc Nursing" value={f.qualification} onChange={ev => set("qualification", ev.target.value)} /></Field>
              <Field label="Experience"><Input placeholder="e.g. 5 years" value={f.experience} onChange={ev => set("experience", ev.target.value)} /></Field>
              <Field label="Joining Date"><Input type="date" value={f.joinDate} onChange={ev => set("joinDate", ev.target.value)} /></Field>
              <Field label="Employment Type">
                <select className={selectCls} value={f.employmentType} onChange={ev => set("employmentType", ev.target.value)}>
                  <option value="">-</option><option value="Full-time">Full-time</option><option value="Part-time">Part-time</option>
                </select>
              </Field>
            </div>
          </Section>

          {/* 3. Documents */}
          <Section title="3. Documents">
            {!editing ? (
              <p className="text-xs text-muted-foreground">{storageOn ? "Save the employee first, then add certificates. Nothing is compulsory." : "Certificate uploads will be available once file storage is connected."}</p>
            ) : !storageOn ? (
              <p className="text-xs text-muted-foreground">Certificate uploads will be available once file storage is connected.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select className={selectCls + " sm:w-72"} value={docType} onChange={ev => setDocType(ev.target.value)}>
                    {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border hover:bg-gray-50 cursor-pointer">
                    <Upload className="w-4 h-4" /> {uploading ? "Uploading..." : "Add files"}
                    <input type="file" multiple accept="image/*,application/pdf" className="hidden" disabled={uploading}
                      onChange={ev => { uploadDocs(ev.target.files); ev.target.value = ""; }} />
                  </label>
                </div>
                {docs.length === 0 ? <p className="text-xs text-muted-foreground">No documents yet.</p> : (
                  <div className="rounded-lg border divide-y">
                    {docs.map(d => (
                      <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{docTypeLabel(d.doc_type)}</p>
                          <p className="text-xs text-muted-foreground truncate">{d.file_name}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                            d.verification_status === "verified" ? "bg-green-50 text-green-700"
                              : d.verification_status === "rejected" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}>
                            {d.verification_status}
                          </span>
                          <button title="View" onClick={() => viewDoc(d)} className="p-1.5 rounded hover:bg-muted"><Eye className="w-3.5 h-3.5" /></button>
                          <button title="Mark verified" onClick={() => setStatus(d, "verified")} className="p-1.5 rounded hover:bg-green-50"><Check className="w-3.5 h-3.5 text-green-600" /></button>
                          <button title="Reject" onClick={() => setStatus(d, "rejected")} className="p-1.5 rounded hover:bg-red-50"><Ban className="w-3.5 h-3.5 text-red-500" /></button>
                          <button title="Delete" onClick={() => delDoc(d)} className="p-1.5 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* 4. Login */}
          <Section title="4. Login Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Role">
                <select className={selectCls} value={f.role} disabled={hasLogin} onChange={ev => set("role", ev.target.value)}>
                  <option value="">-</option>
                  {ROLE_OPTIONS.map(r => <option key={r.v} value={r.v}>{r.l}</option>)}
                </select>
              </Field>
              <Field label="Account Status">
                <select className={selectCls} value={active ? "1" : "0"} onChange={ev => setActive(ev.target.value === "1")}>
                  <option value="1">Active</option><option value="0">Inactive</option>
                </select>
              </Field>
            </div>
            {hasLogin ? (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Login ID</span><span className="font-mono font-semibold">{e.login_code || "-"}</span></div>
                <p className="text-xs text-muted-foreground">Passwords are managed in Password Management. Setting an employee Inactive also blocks their login everywhere.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={wantLogin} disabled={!canLogin} onChange={ev => setWantLogin(ev.target.checked)} />
                  Create login now {canLogin ? "(Login ID is generated automatically)" : "(choose Doctor, Nurse, Front Office, Pharmacist or Lab Technician as the role)"}
                </label>
                {wantLogin && canLogin && (
                  <Field label="Set Password (leave empty to generate a temporary one)">
                    <Input type="text" placeholder="Min 6 characters" value={password} onChange={ev => setPassword(ev.target.value)} />
                  </Field>
                )}
                {!wantLogin && <p className="text-xs text-muted-foreground">You can create the login later by editing this employee.</p>}
              </div>
            )}
          </Section>

          {/* 5. Work */}
          <Section title="5. Work Details">
            <Field label="Shift (select one or more)">
              <div className="flex flex-wrap gap-3 border rounded-md px-3 py-2 bg-white">
                {SHIFTS.map(s => (
                  <label key={s} className="flex items-center gap-1.5 text-sm capitalize cursor-pointer">
                    <input type="checkbox" checked={f.shifts.includes(s)}
                      onChange={ev => set("shifts", ev.target.checked ? [...f.shifts, s] : f.shifts.filter(x => x !== s))} />
                    {s}
                  </label>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Monthly Salary (₹)"><Input inputMode="numeric" placeholder="Monthly salary" value={f.salary} onChange={ev => set("salary", ev.target.value)} /></Field>
              <Field label="Reporting Manager">
                <select className={selectCls} value={f.reportingManagerId} onChange={ev => set("reportingManagerId", ev.target.value)}>
                  <option value="">-</option>
                  {managers.map(m => <option key={m.id} value={m.id}>{m.name} ({String(m.role || "").replace(/_/g, " ")})</option>)}
                </select>
              </Field>
            </div>
            <Field label="Notes">
              <textarea rows={2} value={f.notes} onChange={ev => set("notes", ev.target.value)} placeholder="Additional notes..."
                className="w-full border rounded-md px-3 py-2 text-sm bg-white resize-none" />
            </Field>
          </Section>

          {err && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">{err}</div>}
        </div>

        <div className="px-6 py-4 border-t flex gap-3 justify-end sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={save} disabled={busy}
            className="px-4 py-2 rounded-lg text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors disabled:opacity-50">
            {busy ? "Saving..." : editing ? "Update" : "Add Employee"}
          </button>
        </div>
      </div>
    </div>
  );
}
