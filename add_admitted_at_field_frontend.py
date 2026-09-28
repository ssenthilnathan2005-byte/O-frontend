FILE = "src/pages/hospital-admin/HAInward.tsx"

with open(FILE, "r", encoding="utf-8") as f:
    content = f.read()

# ── 1. api.ts: pass admittedAt through ──────────────────────────────────
API_FILE = "src/api.ts"
with open(API_FILE, "r", encoding="utf-8") as f:
    api_content = f.read()
# No change needed here — inward.admit/update already forward the whole payload object as-is.

# ── 2. Form defaults + type ──────────────────────────────────────────────
old_type = '''  notes: string | null; status: "admitted" | "discharged";
  admitted_at: string; discharged_at: string | null;
};'''
if old_type not in content:
    print("ERROR: type anchor not found. No changes made.")
    raise SystemExit(1)
# (type already has admitted_at — no change needed, kept for clarity)

old_empty_form = '''const EMPTY_FORM = {
  patientName: "", phone: "", age: "", gender: "", ward: "",
  bedNumber: "", admittingDoctorName: "", diagnosis: "", notes: "",
};'''
new_empty_form = '''function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM = {
  patientName: "", phone: "", age: "", gender: "", ward: "",
  bedNumber: "", admittingDoctorName: "", diagnosis: "", notes: "",
  admittedAt: todayStr(),
};'''

if old_empty_form not in content:
    print("ERROR: EMPTY_FORM anchor not found. No changes made.")
    raise SystemExit(1)
content = content.replace(old_empty_form, new_empty_form, 1)

# ── 3. openEdit: pre-fill admittedAt from existing record ────────────────
old_open_edit = '''      admittingDoctorName: p.admitting_doctor_name || "",
      diagnosis: p.diagnosis || "", notes: p.notes || "",
    });
    setEditId(p.id); setShowForm(true);'''
new_open_edit = '''      admittingDoctorName: p.admitting_doctor_name || "",
      diagnosis: p.diagnosis || "", notes: p.notes || "",
      admittedAt: p.admitted_at ? p.admitted_at.slice(0, 10) : todayStr(),
    });
    setEditId(p.id); setShowForm(true);'''

if old_open_edit not in content:
    print("ERROR: openEdit anchor not found. No changes made.")
    raise SystemExit(1)
content = content.replace(old_open_edit, new_open_edit, 1)

# ── 4. handleSubmit: include admittedAt in payload ────────────────────────
old_payload = '''        admittingDoctorName: form.admittingDoctorName,
        diagnosis: form.diagnosis, notes: form.notes,
      };'''
new_payload = '''        admittingDoctorName: form.admittingDoctorName,
        diagnosis: form.diagnosis, notes: form.notes,
        admittedAt: form.admittedAt ? new Date(form.admittedAt).toISOString() : null,
      };'''

if old_payload not in content:
    print("ERROR: payload anchor not found. No changes made.")
    raise SystemExit(1)
content = content.replace(old_payload, new_payload, 1)

# ── 5. Form UI: add "Admitted On" date field ──────────────────────────────
old_fields_block = '''                { label: "Bed Number", key: "bedNumber", placeholder: "e.g. B-12" },
                { label: "Diagnosis", key: "diagnosis", placeholder: "Primary diagnosis" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">{label}</label>
                  <Input placeholder={placeholder} value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}'''
new_fields_block = '''                { label: "Bed Number", key: "bedNumber", placeholder: "e.g. B-12" },
                { label: "Diagnosis", key: "diagnosis", placeholder: "Primary diagnosis" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">{label}</label>
                  <Input placeholder={placeholder} value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Admitted On</label>
                <input type="date" value={form.admittedAt}
                  onChange={e => setForm(f => ({ ...f, admittedAt: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background" />
              </div>'''

if old_fields_block not in content:
    print("ERROR: fields block anchor not found. No changes made.")
    raise SystemExit(1)
content = content.replace(old_fields_block, new_fields_block, 1)

with open(FILE, "w", encoding="utf-8") as f:
    f.write(content)

print("Success: 'Admitted On' date field added to Admit/Update form.")
