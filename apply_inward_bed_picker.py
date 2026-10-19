import io, re, sys
P = r"src\pages\hospital-admin\HAInward.tsx"
raw = io.open(P, encoding="utf-8", newline="").read()
crlf = "\r\n" in raw
t = raw.replace("\r\n", "\n")
if "freeBeds" in t:
    print("ALREADY PATCHED - stop"); sys.exit(0)

def once(old, new, label):
    global t
    n = t.count(old)
    if n != 1:
        print("NOT FOUND ONCE: %s (count=%d) - nothing written" % (label, n)); sys.exit(1)
    t = t.replace(old, new)

def rx(pattern, repl, label):
    global t
    m = list(re.finditer(pattern, t))
    if len(m) != 1:
        print("NOT FOUND ONCE: %s (count=%d) - nothing written" % (label, len(m))); sys.exit(1)
    t = t[:m[0].start()] + repl(m[0]) + t[m[0].end():]

# 1. state
once("  const [matId, setMatId] = useState<string | null>(null);\n",
"""  const [matId, setMatId] = useState<string | null>(null);
  const [freeBeds, setFreeBeds] = useState<any[]>([]);
  const [bedId, setBedId] = useState("");
  const [formError, setFormError] = useState("");
  const [origAdmittedAt, setOrigAdmittedAt] = useState("");
""", "state")

# 2. openAdmit loads free beds
once("function openAdmit() { setForm({ ...EMPTY_FORM }); setEditId(null); setShowForm(true); }",
"""function openAdmit() {
    setForm({ ...EMPTY_FORM }); setEditId(null); setBedId(""); setFormError(""); setFreeBeds([]);
    setShowForm(true);
    api.bedBookings.freeBeds()
      .then((r) => setFreeBeds(Array.isArray(r) ? r : []))
      .catch(() => setFormError("Could not load the free beds. Close and try again."));
  }""", "openAdmit")

# 3. openEdit remembers the original date
once("admittedAt: p.admitted_at ? p.admitted_at.slice(0, 10) : todayStr(),\n    });",
"""admittedAt: p.admitted_at ? p.admitted_at.slice(0, 10) : todayStr(),
    });
    setOrigAdmittedAt(p.admitted_at ? p.admitted_at.slice(0, 10) : "");
    setFormError("");""", "openEdit")

# 4. handleSubmit
NEW_SUBMIT = """  async function handleSubmit() {
    if (!form.patientName.trim()) { setFormError("Enter the patient name."); return; }
    if (!editId && !bedId) { setFormError("Choose a bed from the list."); return; }
    setFormError("");
    setLoading(true);
    try {
      if (editId) {
        const payload: any = {
          diagnosis: form.diagnosis, notes: form.notes,
          admittingDoctorName: form.admittingDoctorName,
        };
        if (form.admittedAt && form.admittedAt !== origAdmittedAt)
          payload.admittedAt = new Date(form.admittedAt).toISOString();
        await api.inward.update(editId, payload);
      } else {
        await api.inward.admit({
          patientName: form.patientName, phone: form.phone,
          age: form.age ? Number(form.age) : null,
          gender: form.gender, bedId,
          admittingDoctorName: form.admittingDoctorName,
          diagnosis: form.diagnosis, notes: form.notes,
          admittedAt: form.admittedAt ? new Date(form.admittedAt).toISOString() : null,
        });
      }
      setShowForm(false); await load();
    } catch (e: any) {
      setFormError(e?.message || "Could not save. Please try again.");
    } finally { setLoading(false); }
  }
"""
rx(r"  async function handleSubmit\(\) \{[\s\S]*?\n  \}\n", lambda m: NEW_SUBMIT, "handleSubmit")

# 5. remove free-text ward and bed inputs
rx(r'[ \t]*\{ label: "Ward", key: "ward"[^\n]*\n', lambda m: "", "ward field")
rx(r'[ \t]*\{ label: "Bed Number", key: "bedNumber"[^\n]*\n', lambda m: "", "bed field")

# 6. lock name/phone/age on edit
once("<Input placeholder={placeholder} value={(form as any)[key]}",
     '<Input placeholder={placeholder} value={(form as any)[key]} disabled={!!editId && ["patientName", "phone", "age"].includes(key)}',
     "lock inputs")

# 7. bed picker (admit) / read-only bed (edit), placed before "Admitted On"
PICKER = """              {editId ? (
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">Ward / Bed</label>
                  <Input disabled value={(() => { const c = patients.find(x => x.id === editId); return c ? `${c.ward || "-"} / ${c.bed_number || "-"}` : ""; })()} />
                  <p className="text-xs text-muted-foreground mt-1">To move the patient to another bed, use the transfer option (coming next).</p>
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">Bed *</label>
                  <select value={bedId} onChange={e => setBedId(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background">
                    <option value="">{freeBeds.length ? "Select a free bed" : "No free beds available"}</option>
                    {Array.from(new Set(freeBeds.map((b: any) => b.ward_name))).map((w: any) => (
                      <optgroup key={w} label={w}>
                        {freeBeds.filter((b: any) => b.ward_name === w).map((b: any) => (
                          <option key={b.bed_id} value={b.bed_id}>{b.bed_number}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              )}
"""
rx(r'[ \t]*<div>\n[ \t]*<label className="text-sm font-medium text-muted-foreground mb-1 block">Admitted On</label>',
   lambda m: PICKER + m.group(0), "picker")

# 8. error line above the footer buttons
once('<div className="px-6 py-4 border-t flex gap-3 justify-end">',
     '{formError && <p className="px-6 pb-2 text-sm text-red-600">{formError}</p>}\n            <div className="px-6 py-4 border-t flex gap-3 justify-end">',
     "error line")

out = t.replace("\n", "\r\n") if crlf else t
io.open(P, "w", encoding="utf-8", newline="").write(out)
print("PATCHED")
