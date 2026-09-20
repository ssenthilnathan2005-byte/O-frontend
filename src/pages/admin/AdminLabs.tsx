import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge }  from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Edit2, FlaskConical, KeyRound, Loader2, Plus, RefreshCw, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import * as api from "../../api";
import type { Lab } from "../../api";

type EditLabForm = { name: string; area: string; address: string; phone: string };

export default function AdminLabs() {
  const [labsList, setLabsList] = useState<Lab[]>([]);
  const [loading, setLoading]   = useState(true);
  const [addOpen, setAddOpen]   = useState(false);
  const [form, setForm] = useState({ name: "", area: "", address: "", phone: "", loginId: "" });
  const [adding, setAdding] = useState(false);

  const [editLab, setEditLab] = useState<Lab | null>(null);
  const [editForm, setEditForm] = useState<EditLabForm>({ name: "", area: "", address: "", phone: "" });
  const [saving, setSaving] = useState(false);

  const [loginDialogLab, setLoginDialogLab] = useState<Lab | null>(null);
  const [loginInfo, setLoginInfo] = useState<{ loginId: string | null; hasAdminAccount: boolean; firstLogin: boolean } | null>(null);
  const [loginInfoLoading, setLoginInfoLoading] = useState(false);
  const [newLoginIdInput, setNewLoginIdInput] = useState("");
  const [resetting, setResetting] = useState(false);

  function loadLabs() {
    setLoading(true);
    api.labs.list().then(setLabsList).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { loadLabs(); }, []);

  // ── Add lab ──────────────────────────────────────────────────────────────
  async function handleAdd() {
    if (!form.name || !form.area) { toast.error("Name and location are required"); return; }
    setAdding(true);
    try {
      const newLab = await api.labs.create({
        name: form.name, area: form.area,
        address: form.address || undefined, phone: form.phone || undefined,
      });
      if (form.loginId.trim()) {
        await api.labs.resetLogin(newLab.id, form.loginId.trim());
        toast.success(`Lab "${form.name}" added — share login ID "${form.loginId.trim()}" with their staff`);
      } else {
        toast.success(`Lab "${form.name}" added`);
      }
      setForm({ name: "", area: "", address: "", phone: "", loginId: "" });
      setAddOpen(false);
      loadLabs();
    } catch (err: any) {
      toast.error(err.message || "Failed to add lab");
    } finally {
      setAdding(false);
    }
  }

  // ── Edit lab ─────────────────────────────────────────────────────────────
  function openEditLab(lab: Lab) {
    setEditLab(lab);
    setEditForm({ name: lab.name, area: lab.area, address: lab.address ?? "", phone: lab.phone ?? "" });
  }
  async function handleEditLab() {
    if (!editLab) return;
    if (!editForm.name || !editForm.area) { toast.error("Name and location are required"); return; }
    setSaving(true);
    try {
      await api.labs.update(editLab.id, editForm);
      toast.success("Lab updated");
      setEditLab(null);
      loadLabs();
    } catch (err: any) {
      toast.error(err.message || "Failed to update lab");
    } finally {
      setSaving(false);
    }
  }

  // ── Login management ────────────────────────────────────────────────────
  async function openLoginDialog(lab: Lab) {
    setLoginDialogLab(lab);
    setLoginInfo(null);
    setNewLoginIdInput("");
    setLoginInfoLoading(true);
    try {
      const info = await api.labs.getAdminInfo(lab.id);
      setLoginInfo(info);
    } catch (err: any) {
      toast.error(err.message || "Failed to load login info");
    } finally {
      setLoginInfoLoading(false);
    }
  }
  async function handleResetLogin() {
    if (!loginDialogLab) return;
    setResetting(true);
    try {
      const res = await api.labs.resetLogin(loginDialogLab.id, newLoginIdInput.trim() || undefined);
      setLoginInfo({ loginId: res.loginId, hasAdminAccount: res.hasAdminAccount, firstLogin: true });
      setNewLoginIdInput("");
      toast.success("Lab staff will need to set a new password on next login");
    } catch (err: any) {
      toast.error(err.message || "Failed to reset login");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Lab Management</h1>
          <p className="text-muted-foreground mt-1">{labsList.length} labs registered</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Lab
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Lab</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              {[
                { label: "Lab Name *", key: "name", placeholder: "e.g. City Diagnostics" },
                { label: "Location / Area *", key: "area", placeholder: "e.g. Gandhipuram" },
                { label: "Full Address", key: "address", placeholder: "e.g. 45 Main Rd" },
                { label: "Phone", key: "phone", placeholder: "e.g. 9876543210" },
              ].map(({ label, key, placeholder }) => (
                <div key={key} className="space-y-1.5">
                  <Label>{label}</Label>
                  <Input placeholder={placeholder} value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
              <div className="space-y-1.5">
                <Label>Lab Staff Login ID (optional)</Label>
                <Input placeholder="e.g. city_diagnostics" value={form.loginId}
                  onChange={e => setForm(f => ({ ...f, loginId: e.target.value }))} />
                <p className="text-xs text-muted-foreground">
                  If set, this lab's staff can log in and manage their own tests, pricing, and bookings. You can also add this later.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={adding}>
                {adding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Add Lab
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Lab</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-center">Rating</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading...
              </TableCell></TableRow>
            ) : labsList.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                No labs yet — click "Add Lab" to create one.
              </TableCell></TableRow>
            ) : labsList.map((lab) => (
              <TableRow key={lab.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
                      <FlaskConical className="w-4 h-4 text-teal-600" />
                    </div>
                    <span className="font-medium">{lab.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{lab.area}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{lab.address ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{lab.phone ?? "—"}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className="gap-1">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {lab.rating.toFixed(1)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => openEditLab(lab)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openLoginDialog(lab)}>
                      <KeyRound className="w-4 h-4 mr-1" /> Login
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editLab} onOpenChange={open => !open && setEditLab(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Lab: {editLab?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {[
              { label: "Lab Name *", key: "name", placeholder: "e.g. City Diagnostics" },
              { label: "Location / Area *", key: "area", placeholder: "e.g. Gandhipuram" },
              { label: "Full Address", key: "address", placeholder: "e.g. 45 Main Rd" },
              { label: "Phone", key: "phone", placeholder: "e.g. 9876543210" },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="space-y-1.5">
                <Label>{label}</Label>
                <Input placeholder={placeholder} value={(editForm as any)[key]}
                  onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLab(null)}>Cancel</Button>
            <Button onClick={handleEditLab} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Login Dialog */}
      <Dialog open={!!loginDialogLab} onOpenChange={open => { if (!open) { setLoginDialogLab(null); setLoginInfo(null); setNewLoginIdInput(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Staff Login: {loginDialogLab?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {loginInfoLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
              </div>
            ) : loginInfo?.loginId ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-teal-200 bg-teal-50 p-3">
                  <p className="text-xs font-semibold text-teal-600 mb-1">Login ID</p>
                  <code className="text-sm font-bold text-teal-700">{loginInfo.loginId}</code>
                  <p className="text-xs text-teal-700 mt-2">
                    {loginInfo.firstLogin
                      ? "This lab hasn't set a password yet — share this login ID with them; they'll set their own password on first login."
                      : "This lab's staff have already set their password."}
                  </p>
                </div>
                <div className="space-y-1.5 pt-2 border-t border-border">
                  <Label>Reset login (forces a new password to be set)</Label>
                  <Input placeholder="New login ID (optional — leave blank to keep current)"
                    value={newLoginIdInput} onChange={e => setNewLoginIdInput(e.target.value)} />
                  <Button variant="outline" size="sm" className="mt-1" onClick={handleResetLogin} disabled={resetting}>
                    {resetting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    Reset Login
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  No staff login set up for this lab yet. Create one below.
                </p>
                <div className="space-y-1.5">
                  <Label>Login ID</Label>
                  <Input placeholder="e.g. city_diagnostics" value={newLoginIdInput}
                    onChange={e => setNewLoginIdInput(e.target.value)} />
                </div>
                <Button onClick={handleResetLogin} disabled={resetting || !newLoginIdInput.trim()}>
                  {resetting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Create Login
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoginDialogLab(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
