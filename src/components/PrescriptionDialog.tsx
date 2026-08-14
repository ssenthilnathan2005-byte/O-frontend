import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pill, Send } from "lucide-react";
import { getToken } from "@/api";
import { toast } from "sonner";

interface Medicine {
  name: string;
  dosage: string;
  duration: string;
  instructions: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void; // called after prescription saved (or skipped)
  booking: {
    id: string;
    patientId?: string;
    patientName?: string;
    patientAge?: number;
  } | null;
  doctorId: string;
  doctorName: string;
  hospitalId: string;
  hospitalName: string;
}

const EMPTY_MED: Medicine = { name: "", dosage: "", duration: "", instructions: "" };

export default function PrescriptionDialog({
  open, onClose, onConfirm, booking, doctorId, doctorName, hospitalId, hospitalName
}: Props) {
  const [medicines, setMedicines] = useState<Medicine[]>([{ ...EMPTY_MED }]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeMedIdx, setActiveMedIdx] = useState<number | null>(null);

  function updateMed(idx: number, field: keyof Medicine, value: string) {
    setMedicines(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  }

  async function searchMedicines(idx: number, q: string) {
    updateMed(idx, "name", q);
    setActiveMedIdx(idx);
    if (q.length < 2) { setSuggestions([]); return; }
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}/pharmacy/medicines?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setSuggestions(data.map((m: any) => m.name));
    } catch { setSuggestions([]); }
  }

  function pickSuggestion(idx: number, name: string) {
    updateMed(idx, "name", name);
    setSuggestions([]);
    setActiveMedIdx(null);
  }

  function addMed() { setMedicines(prev => [...prev, { ...EMPTY_MED }]); }
  function removeMed(idx: number) { setMedicines(prev => prev.filter((_, i) => i !== idx)); }

  async function handleSave() {
    const validMeds = medicines.filter(m => m.name.trim());
    if (!booking?.id) { onConfirm(); return; }
    setSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000/api"}/prescriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          bookingId: booking.id,
          doctorId,
          doctorName,
          patientId: booking.patientId,
          patientName: booking.patientName ?? "Walk-in",
          hospitalId,
          hospitalName,
          items: validMeds,
          notes,
        }),
      });
      if (res.ok) {
        toast.success("Prescription saved ✓");
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed to save prescription");
      }
    } catch {
      toast.error("Network error saving prescription");
    } finally {
      setSaving(false);
      setMedicines([{ ...EMPTY_MED }]);
      setNotes("");
      onConfirm();
    }
  }

  function handleSkip() {
    setMedicines([{ ...EMPTY_MED }]);
    setNotes("");
    onConfirm();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pill className="w-5 h-5 text-blue-600" />
            Write Prescription
          </DialogTitle>
          {booking && (
            <p className="text-sm text-gray-500">
              {booking.patientName ?? "Walk-in"}
              {booking.patientAge != null && ` · ${booking.patientAge} yrs`}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {medicines.map((med, idx) => (
            <div key={idx} className="border rounded-xl p-3 space-y-2 bg-gray-50 relative">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">Medicine {idx + 1}</Badge>
                {medicines.length > 1 && (
                  <button onClick={() => removeMed(idx)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="relative">
                <Label className="text-xs text-gray-500">Medicine Name</Label>
                <Input
                  placeholder="e.g. Paracetamol"
                  value={med.name}
                  onChange={e => searchMedicines(idx, e.target.value)}
                  onFocus={() => setActiveMedIdx(idx)}
                />
                {activeMedIdx === idx && suggestions.length > 0 && (
                  <div className="absolute z-10 bg-white border rounded-lg shadow-lg mt-1 w-full">
                    {suggestions.map(s => (
                      <button
                        key={s}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50"
                        onClick={() => pickSuggestion(idx, s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-gray-500">Dosage</Label>
                  <Input placeholder="e.g. 500mg" value={med.dosage} onChange={e => updateMed(idx, "dosage", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Duration</Label>
                  <Input placeholder="e.g. 5 days" value={med.duration} onChange={e => updateMed(idx, "duration", e.target.value)} />
                </div>
              </div>

              <div>
                <Label className="text-xs text-gray-500">Instructions</Label>
                <Input placeholder="e.g. After food, twice daily" value={med.instructions} onChange={e => updateMed(idx, "instructions", e.target.value)} />
              </div>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addMed} className="w-full border-dashed">
            <Plus className="w-4 h-4 mr-1" /> Add Medicine
          </Button>

          <div>
            <Label className="text-xs text-gray-500">Doctor's Notes (optional)</Label>
            <Textarea
              placeholder="Additional notes, advice, follow-up instructions..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2 mt-2">
          <Button variant="ghost" size="sm" onClick={handleSkip} disabled={saving}>
            Skip — No Prescription
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
            onClick={handleSave}
            disabled={saving}
          >
            <Send className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save & Complete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
