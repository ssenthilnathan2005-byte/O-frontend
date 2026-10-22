import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { familyMembers } from "../api";
import type { FamilyMember } from "../api";

const GENDERS = ["Male", "Female", "Other"];
const BLOODS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const RELATIONS = ["Father", "Mother", "Spouse", "Son", "Daughter", "Brother", "Sister", "Grandfather", "Grandmother", "Other"];

type Form = { id: string; relation: string; name: string; yearOfBirth: string; gender: string; bloodGroup: string };
const EMPTY: Form = { id: "", relation: "", name: "", yearOfBirth: "", gender: "", bloodGroup: "" };

export default function FamilyMembersSection() {
  const [list, setList] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try { setList(await familyMembers.list()); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const now = new Date().getFullYear();
  const isSelf = form?.relation === "Self";
  const yr = Number(form?.yearOfBirth || "");
  const yrOk = !!form && /^\d{4}$/.test(form.yearOfBirth) && yr >= now - 120 && yr <= now;

  async function save() {
    if (!form) return;
    if (!form.relation.trim() || !form.name.trim()) { toast.error("Relation and name are required"); return; }
    if (!yrOk) { toast.error("Enter a valid year of birth"); return; }
    const payload = {
      relation: form.relation.trim(), name: form.name.trim(),
      yearOfBirth: form.yearOfBirth, gender: form.gender, bloodGroup: form.bloodGroup,
    };
    setSaving(true);
    try {
      if (form.id) await familyMembers.update(form.id, payload);
      else await familyMembers.add(payload);
      toast.success("Saved");
      setForm(null);
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function remove(m: FamilyMember) {
    if (!window.confirm("Remove " + m.name + "?")) return;
    try {
      await familyMembers.remove(m.id);
      toast.success("Removed");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Could not remove");
    }
  }

  const input = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300";

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 mt-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-teal-600" />
          <p className="text-sm font-medium text-gray-900">Family Members</p>
        </div>
        {!form && (
          <button type="button" onClick={() => setForm({ ...EMPTY })}
            className="text-xs font-medium text-teal-600 hover:text-teal-700 flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-3 text-center"><Loader2 className="w-5 h-5 animate-spin text-teal-500 mx-auto" /></div>
      ) : (
        <div className="space-y-2">
          {list.length === 0 && !form && (
            <p className="text-xs text-gray-400">Add your parents, spouse or children to book for them in one tap.</p>
          )}
          {list.map(m => (
            <div key={m.id} className="flex items-center justify-between gap-2 border border-gray-100 rounded-xl p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  <span className="text-teal-600">{m.relation}</span> - {m.name}
                </p>
                <p className="text-xs text-gray-500">
                  {[m.age ? m.age + " yrs" : "", m.gender, m.bloodGroup].filter(Boolean).join(" | ")}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" aria-label="Edit"
                  onClick={() => setForm({ id: m.id, relation: m.relation, name: m.name, yearOfBirth: m.yearOfBirth, gender: m.gender, bloodGroup: m.bloodGroup })}
                  className="p-2 text-gray-400 hover:text-teal-600"><Pencil className="w-4 h-4" /></button>
                {m.relation !== "Self" && (
                  <button type="button" aria-label="Remove" onClick={() => void remove(m)}
                    className="p-2 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            </div>
          ))}

          {form && (
            <div className="border border-teal-200 bg-teal-50/40 rounded-xl p-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Relation</label>
                  <input list="family-relations" className={input} value={form.relation} disabled={isSelf}
                    placeholder="e.g. Mother" onChange={e => setForm({ ...form, relation: e.target.value })} />
                  <datalist id="family-relations">{RELATIONS.map(r => <option key={r} value={r} />)}</datalist>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Name</label>
                  <input className={input} value={form.name} disabled={isSelf} placeholder="Full name"
                    onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Year of Birth</label>
                  <input className={input} value={form.yearOfBirth} disabled={isSelf} inputMode="numeric" maxLength={4}
                    placeholder="e.g. 1965"
                    onChange={e => setForm({ ...form, yearOfBirth: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Age</label>
                  <input className={input + " bg-gray-50 cursor-not-allowed"} readOnly tabIndex={-1} placeholder="Auto"
                    value={yrOk ? String(now - yr) : ""} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Gender</label>
                  <select className={input} value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                    <option value="">Select</option>
                    {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Blood Group</label>
                  <select className={input} value={form.bloodGroup} onChange={e => setForm({ ...form, bloodGroup: e.target.value })}>
                    <option value="">Select</option>
                    {BLOODS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              {isSelf && <p className="text-xs text-gray-400">Your name and year of birth come from your profile above.</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm(null)} disabled={saving}
                  className="flex-1 h-10 rounded-full border border-gray-200 text-sm font-medium text-gray-600">Cancel</button>
                <button type="button" onClick={() => void save()} disabled={saving}
                  className="flex-1 h-10 rounded-full bg-teal-500 hover:bg-teal-600 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}