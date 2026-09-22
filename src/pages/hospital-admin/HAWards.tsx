import { useEffect, useState } from "react";
import { useStore } from "../../context/StoreContext";
import { BedDouble, Plus, X, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getToken } from "../../api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

type Ward = {
  id: string; name: string; type: string; total_beds: number;
  available_beds: number; occupied_beds: number; maintenance_beds: number;
};

type Bed = {
  id: string; bed_number: string; status: "available" | "occupied" | "maintenance";
  patient_name: string | null;
  occupant_name: string | null;
  occupant_phone: string | null;
  occupant_age: number | null;
  occupant_gender: string | null;
  occupant_doctor: string | null;
  occupant_diagnosis: string | null;
  occupant_notes: string | null;
  occupant_admitted_at: string | null;
};

const EMPTY_OCCUPY = { patientName:"", phone:"", age:"", gender:"", admittingDoctorName:"", diagnosis:"", notes:"" };

const WARD_TYPES = ["general", "icu", "emergency", "maternity", "paediatric", "surgical", "orthopaedic", "private"];

const STATUS_COLORS: Record<string, string> = {
  available:   "bg-green-50 text-green-700 border-green-200",
  occupied:    "bg-red-50 text-red-700 border-red-200",
  maintenance: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

export default function HAWards() {
  const { user } = useStore();
  const hospitalId = user?.role === "hospital_admin" ? (user as any).hospitalId : "";

  const [wards, setWards] = useState<Ward[]>([]);
  const [beds, setBeds] = useState<Record<string, Bed[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", type: "general", totalBeds: "10" });
  const [loading, setLoading] = useState(false);
  const [bedLoading, setBedLoading] = useState<string | null>(null);
  const [occupyTarget, setOccupyTarget] = useState<{ wardId: string; bed: Bed } | null>(null);
  const [occupyForm, setOccupyForm] = useState({ ...EMPTY_OCCUPY });
  const [detailsTarget, setDetailsTarget] = useState<{ wardId: string; bed: Bed } | null>(null);

  async function api(path: string, method = "GET", body?: any) {
    const res = await fetch(`${BASE}${path}`, {
      method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  }

  async function loadWards() {
    try { setWards(await api("/wards")); } catch {}
  }

  async function loadBeds(wardId: string) {
    try {
      const data = await api(`/wards/${wardId}/beds`);
      setBeds(prev => ({ ...prev, [wardId]: data }));
    } catch {}
  }

  useEffect(() => { if (hospitalId) loadWards(); }, [hospitalId]);

  async function handleExpand(wardId: string) {
    if (expanded === wardId) { setExpanded(null); return; }
    setExpanded(wardId);
    if (!beds[wardId]) await loadBeds(wardId);
  }

  async function handleCreateWard() {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      await api("/wards", "POST", { name: form.name, type: form.type, totalBeds: Number(form.totalBeds) });
      setShowForm(false);
      setForm({ name: "", type: "general", totalBeds: "10" });
      await loadWards();
    } catch {} finally { setLoading(false); }
  }

  async function handleOccupy() {
    if (!occupyTarget || !occupyForm.patientName.trim()) return;
    const { wardId, bed } = occupyTarget;
    setBedLoading(bed.id);
    try {
      await api(`/wards/${wardId}/beds/${bed.id}/occupy`, "POST", {
        patientName: occupyForm.patientName,
        phone: occupyForm.phone || null,
        age: occupyForm.age ? Number(occupyForm.age) : null,
        gender: occupyForm.gender || null,
        admittingDoctorName: occupyForm.admittingDoctorName || null,
        diagnosis: occupyForm.diagnosis || null,
        notes: occupyForm.notes || null,
      });
      setOccupyTarget(null);
      setOccupyForm({ ...EMPTY_OCCUPY });
      await loadBeds(wardId);
      await loadWards();
    } catch {} finally { setBedLoading(null); }
  }

  async function handleVacate(wardId: string, bedId: string) {
    if (!confirm("Discharge this patient and send the bed for cleaning?")) return;
    setBedLoading(bedId);
    try {
      await api(`/wards/${wardId}/beds/${bedId}/vacate`, "PATCH", {});
      setDetailsTarget(null);
      await loadBeds(wardId);
      await loadWards();
    } catch {} finally { setBedLoading(null); }
  }

  async function handleReady(wardId: string, bedId: string) {
    setBedLoading(bedId);
    try {
      await api(`/wards/${wardId}/beds/${bedId}/ready`, "PATCH", {});
      await loadBeds(wardId);
      await loadWards();
    } catch {} finally { setBedLoading(null); }
  }

  function handleBedClick(wardId: string, bed: Bed) {
    if (bed.status === "available") {
      setOccupyForm({ ...EMPTY_OCCUPY });
      setOccupyTarget({ wardId, bed });
    } else if (bed.status === "occupied") {
      setDetailsTarget({ wardId, bed });
    } else {
      handleReady(wardId, bed.id);
    }
  }

  async function handleDeleteWard(wardId: string) {
    if (!confirm("Delete this ward and all its beds?")) return;
    try { await api(`/wards/${wardId}`, "DELETE"); await loadWards(); } catch {}
  }

  const totalBeds = wards.reduce((s, w) => s + Number(w.total_beds || 0), 0);
  const totalOccupied = wards.reduce((s, w) => s + Number(w.occupied_beds || 0), 0);
  const totalAvailable = wards.reduce((s, w) => s + Number(w.available_beds || 0), 0);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BedDouble className="w-5 h-5 text-teal-600" />
          <h1 className="text-xl font-bold">Beds & Wards</h1>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Ward
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Beds", value: totalBeds, color: "text-gray-800" },
          { label: "Occupied", value: totalOccupied, color: "text-red-600" },
          { label: "Available", value: totalAvailable, color: "text-green-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Ward List */}
      {wards.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No wards added yet. Add your first ward.</div>
      ) : (
        <div className="space-y-3">
          {wards.map(ward => (
            <div key={ward.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-semibold text-gray-800">{ward.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{ward.type} ward</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-700">{ward.available_beds} free</span>
                    <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700">{ward.occupied_beds} occupied</span>
                    {Number(ward.maintenance_beds) > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700">{ward.maintenance_beds} maintenance</span>
                    )}
                  </div>
                  <button onClick={() => handleDeleteWard(ward.id)} className="p-1.5 rounded hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                  <button onClick={() => handleExpand(ward.id)} className="p-1.5 rounded hover:bg-gray-100 transition-colors">
                    {expanded === ward.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Bed Grid */}
              {expanded === ward.id && (
                <div className="border-t px-5 py-4">
                  {!beds[ward.id] ? (
                    <p className="text-sm text-gray-400">Loading beds...</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {beds[ward.id].map(bed => (
                        <div key={bed.id} className={`rounded-lg border p-2 text-center text-xs cursor-pointer transition-all ${STATUS_COLORS[bed.status]}`}
                          onClick={() => handleBedClick(ward.id, bed)}>
                          <p className="font-bold">{bed.bed_number}</p>
                          <p className="capitalize mt-0.5 opacity-80">
                            {bed.status === "maintenance" ? "Cleaning" : bed.status}
                          </p>
                          {bed.patient_name && <p className="truncate mt-0.5 font-medium">{bed.patient_name}</p>}
                          {bedLoading === bed.id && <p className="text-[10px] opacity-60">saving...</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Ward Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-lg">Add Ward</h2>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Ward Name *</label>
                <Input placeholder="e.g. General Ward A" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Ward Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white">
                  {WARD_TYPES.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Number of Beds</label>
                <Input type="number" min="1" max="100" placeholder="10" value={form.totalBeds}
                  onChange={e => setForm(f => ({ ...f, totalBeds: e.target.value }))} />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleCreateWard} disabled={loading}
                className="px-4 py-2 rounded-lg text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors disabled:opacity-50">
                {loading ? "Creating..." : "Create Ward"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Occupy Bed Modal */}
      {occupyTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-lg">Admit Patient — Bed {occupyTarget.bed.bed_number}</h2>
              <button onClick={() => setOccupyTarget(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Patient Name *</label>
                <Input placeholder="Full name" value={occupyForm.patientName}
                  onChange={e => setOccupyForm(f => ({ ...f, patientName: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Phone</label>
                  <Input placeholder="Mobile number" value={occupyForm.phone}
                    onChange={e => setOccupyForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Age</label>
                  <Input type="number" min="0" placeholder="Age" value={occupyForm.age}
                    onChange={e => setOccupyForm(f => ({ ...f, age: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Gender</label>
                <select value={occupyForm.gender} onChange={e => setOccupyForm(f => ({ ...f, gender: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white">
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Admitting Doctor</label>
                <Input placeholder="Doctor name" value={occupyForm.admittingDoctorName}
                  onChange={e => setOccupyForm(f => ({ ...f, admittingDoctorName: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Reason for Admission / Diagnosis *</label>
                <textarea value={occupyForm.diagnosis} onChange={e => setOccupyForm(f => ({ ...f, diagnosis: e.target.value }))}
                  rows={2} placeholder="e.g. Maternity — delivery, Post-op recovery, Fracture..."
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white resize-none" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Notes</label>
                <textarea value={occupyForm.notes} onChange={e => setOccupyForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Additional notes..."
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button onClick={() => setOccupyTarget(null)}
                className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleOccupy} disabled={bedLoading === occupyTarget.bed.id || !occupyForm.patientName.trim()}
                className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-50">
                {bedLoading === occupyTarget.bed.id ? "Admitting..." : "Admit & Occupy Bed"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bed Details Modal */}
      {detailsTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-lg">Bed {detailsTarget.bed.bed_number}</h2>
              <button onClick={() => setDetailsTarget(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-2 text-sm">
              <p><span className="text-gray-500">Patient:</span> <span className="font-medium">{detailsTarget.bed.occupant_name || detailsTarget.bed.patient_name || "—"}</span></p>
              {detailsTarget.bed.occupant_age != null && (
                <p><span className="text-gray-500">Age / Gender:</span> {detailsTarget.bed.occupant_age} {detailsTarget.bed.occupant_gender ? `/ ${detailsTarget.bed.occupant_gender}` : ""}</p>
              )}
              {detailsTarget.bed.occupant_phone && (
                <p><span className="text-gray-500">Phone:</span> {detailsTarget.bed.occupant_phone}</p>
              )}
              {detailsTarget.bed.occupant_doctor && (
                <p><span className="text-gray-500">Admitting Doctor:</span> {detailsTarget.bed.occupant_doctor}</p>
              )}
              {detailsTarget.bed.occupant_diagnosis && (
                <p><span className="text-gray-500">Reason / Diagnosis:</span> {detailsTarget.bed.occupant_diagnosis}</p>
              )}
              {detailsTarget.bed.occupant_notes && (
                <p><span className="text-gray-500">Notes:</span> {detailsTarget.bed.occupant_notes}</p>
              )}
              {detailsTarget.bed.occupant_admitted_at && (
                <p><span className="text-gray-500">Admitted:</span> {new Date(detailsTarget.bed.occupant_admitted_at).toLocaleString()}</p>
              )}
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button onClick={() => setDetailsTarget(null)}
                className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition-colors">Close</button>
              <button onClick={() => handleVacate(detailsTarget.wardId, detailsTarget.bed.id)}
                disabled={bedLoading === detailsTarget.bed.id}
                className="px-4 py-2 rounded-lg text-sm bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors disabled:opacity-50">
                {bedLoading === detailsTarget.bed.id ? "Discharging..." : "Discharge & Send for Cleaning"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
