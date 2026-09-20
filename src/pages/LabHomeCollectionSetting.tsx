import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import * as api from "../api";

export default function LabHomeCollectionSetting() {
  const [enabled, setEnabled] = useState(false);
  const [fee, setFee] = useState("0");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.labs.getSettings()
      .then((s) => { setEnabled(s.homeCollection); setFee(String(s.homeCollectionFee ?? 0)); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function save() {
    const f = Number(fee);
    if (!Number.isFinite(f) || f < 0) { toast.error("Enter a valid fee"); return; }
    setSaving(true);
    try {
      const s = await api.labs.updateSettings({ homeCollection: enabled, homeCollectionFee: f });
      setEnabled(s.homeCollection);
      setFee(String(s.homeCollectionFee));
      toast.success("Home collection settings saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-gray-900 text-sm">Home sample collection</p>
          <p className="text-xs text-gray-400">Patients only see the Home Collection option when this is on.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 shrink-0">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 accent-teal-500"
          />
          We offer it
        </label>
      </div>
      {enabled && (
        <div className="mt-3 flex items-end gap-3">
          <div className="w-40">
            <label className="text-xs font-medium text-gray-600 mb-1 block">Extra fee (₹)</label>
            <Input type="number" min="0" value={fee} onChange={(e) => setFee(e.target.value)} />
          </div>
          <p className="text-xs text-gray-400 pb-2">Added to the test price for home bookings. Use 0 for free.</p>
        </div>
      )}
      <Button size="sm" onClick={save} disabled={saving} className="mt-3 bg-teal-500 hover:bg-teal-600 text-white">
        {saving ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
