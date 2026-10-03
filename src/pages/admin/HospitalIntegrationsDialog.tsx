import { useEffect, useState } from "react";
import { Copy, Loader2, Plus, RefreshCw, Trash2, Power } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getToken } from "../../api";
import type { Hospital } from "../../api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

type Integration = {
  id: string; hospital_id: string; type: string; name: string;
  config: { model?: string; notes?: string }; enabled: boolean;
  last_seen_at: string | null; created_at: string;
};

const TYPES = [
  { value: "fingerprint", label: "Fingerprint scanner" },
  { value: "id_card", label: "ID card scanner" },
  { value: "face", label: "Face recognition" },
  { value: "other", label: "Other" },
];

async function call(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${BASE}/hospital-integrations${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `Request failed (${res.status})`);
  return data;
}

export default function HospitalIntegrationsDialog({
  hospital, onClose,
}: { hospital: Hospital | null; onClose: () => void }) {
  const [items, setItems] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: "fingerprint", name: "", model: "", notes: "" });
  const [shownKey, setShownKey] = useState<{ name: string; key: string } | null>(null);

  async function load() {
    if (!hospital) return;
    setLoading(true);
    try { setItems(await call(`?hospitalId=${encodeURIComponent(hospital.id)}`)); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    setShownKey(null);
    setForm({ type: "fingerprint", name: "", model: "", notes: "" });
    if (hospital) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospital?.id]);

  async function handleCreate() {
    if (!hospital) return;
    if (!form.name.trim()) { toast.error("Give the device a name"); return; }
    setSaving(true);
    try {
      const r = await call("", "POST", {
        hospitalId: hospital.id, type: form.type, name: form.name.trim(),
        config: { model: form.model.trim(), notes: form.notes.trim() },
      });
      setShownKey({ name: r.name, key: r.apiKey });
      setForm({ type: "fingerprint", name: "", model: "", notes: "" });
      await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function toggle(i: Integration) {
    try { await call(`/${i.id}`, "PATCH", { enabled: !i.enabled }); await load(); }
    catch (e: any) { toast.error(e.message); }
  }

  async function rotate(i: Integration) {
    if (!window.confirm(`Rotate the key for "${i.name}"? The device/agent stops working until it gets the new key.`)) return;
    try {
      const r = await call(`/${i.id}/rotate-key`, "POST");
      setShownKey({ name: r.name, key: r.apiKey });
      await load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function remove(i: Integration) {
    if (!window.confirm(`Delete "${i.name}" and ALL its attendance logs? This cannot be undone.`)) return;
    try { await call(`/${i.id}`, "DELETE"); await load(); toast.success("Integration deleted"); }
    catch (e: any) { toast.error(e.message); }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(() => toast.success("Copied"), () => toast.error("Copy failed"));
  }

  const ingestUrl = `${BASE}/hospital-integrations/ingest`;

  return (
    <Dialog open={!!hospital} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Integrations: {hospital?.name}</DialogTitle></DialogHeader>

        {shownKey && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2">
            <p className="text-xs font-semibold text-amber-800">
              API key for "{shownKey.name}": copy it now, it will not be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs break-all bg-white border rounded px-2 py-1">{shownKey.key}</code>
              <Button size="sm" variant="outline" onClick={() => copy(shownKey.key)}><Copy className="w-4 h-4" /></Button>
            </div>
            <p className="text-xs text-amber-800">
              The device agent sends punches to <code>{ingestUrl}</code> with header <code>X-Integration-Key</code>.
            </p>
            <Button size="sm" variant="ghost" onClick={() => setShownKey(null)}>I've saved it</Button>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-semibold">Connected devices</p>
          {loading ? (
            <div className="flex items-center text-muted-foreground text-sm py-4">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading...
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No integrations yet for this hospital.</p>
          ) : items.map(i => (
            <div key={i.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {i.name}{" "}
                  <span className="text-xs text-muted-foreground">
                    · {TYPES.find(t => t.value === i.type)?.label ?? i.type}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {i.config?.model ? `${i.config.model} · ` : ""}
                  {i.last_seen_at ? `Last seen ${new Date(i.last_seen_at).toLocaleString("en-IN")}` : "Never connected"}
                  {!i.enabled ? " · DISABLED" : ""}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="ghost" title={i.enabled ? "Disable" : "Enable"} onClick={() => toggle(i)}>
                  <Power className={`w-4 h-4 ${i.enabled ? "text-teal-600" : "text-gray-400"}`} />
                </Button>
                <Button size="sm" variant="ghost" title="Rotate key" onClick={() => rotate(i)}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" title="Delete" className="text-destructive" onClick={() => remove(i)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3 pt-3 border-t">
          <p className="text-sm font-semibold">Add a device</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              >
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input placeholder="e.g. Main gate scanner" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Device model</Label>
              <Input placeholder="e.g. ZKTeco K40" value={form.model}
                onChange={e => setForm(f => ({ ...f, model: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input placeholder="IP, location, anything useful" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Create &amp; generate key
          </Button>
        </div>

        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
