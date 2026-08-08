import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useStore } from "../../context/StoreContext";
import type { Doctor } from "../../api";

const STANDARD_FEE = 10;

type AddForm = {
  name: string;
  phone: string;
  specialty: string;
  tokensPerSession: string;
  sessions: string;
};

type EditForm = {
  name: string;
  phone: string;
  specialty: string;
  tokensPerSession: string;
  sessions: string;
  isAvailable: boolean;
};

const EMPTY_ADD: AddForm = {
  name: "", phone: "", specialty: "", tokensPerSession: "20", sessions: "morning,afternoon",
};

export default function HADoctors() {
  const { doctors, user, addDoctor, deleteDoctor, updateDoctor } = useStore();
  const hospitalId = user && user.role === "hospital_admin" ? user.hospitalId : "";
  const myDoctors = doctors.filter((d) => d.hospitalId === hospitalId);

  const [addOpen, setAddOpen] = useState(false);
  const [editDoctor, setEditDoctor] = useState<Doctor | null>(null);
  const [addForm, setAddForm] = useState<AddForm>(EMPTY_ADD);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "", phone: "", specialty: "", tokensPerSession: "20",
    sessions: "morning,afternoon", isAvailable: true,
  });

  async function handleAdd() {
    if (!addForm.name || !addForm.specialty) {
      toast.error("Name and specialty are required");
      return;
    }
    const tokens = Number.parseInt(addForm.tokensPerSession, 10) || 20;
    const sessions = addForm.sessions.split(",").map((s) => s.trim()) as Doctor["sessions"];
    try {
      const newDoc = await addDoctor({
        name: addForm.name,
        phone: addForm.phone,
        specialty: addForm.specialty,
        hospitalId,
        consultationFee: STANDARD_FEE,
        price: STANDARD_FEE,
        tokensPerSession: tokens,
        sessions,
        isAvailable: true,
      });
      toast.success(`Doctor ${newDoc.name} added with code ${newDoc.code}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to add doctor");
      return;
    }
    setAddForm(EMPTY_ADD);
    setAddOpen(false);
  }

  function openEdit(doc: Doctor) {
    setEditDoctor(doc);
    setEditForm({
      name: doc.name ?? "",
      phone: doc.phone ?? "",
      specialty: doc.specialty ?? "",
      tokensPerSession: String(doc.tokensPerSession ?? 20),
      sessions: Array.isArray(doc.sessions) ? (doc.sessions as string[]).join(",") : (doc.sessions as any ?? "morning,afternoon"),
      isAvailable: doc.isAvailable ?? true,
    });
  }

  async function handleEdit() {
    if (!editDoctor) return;
    const tokens = Number.parseInt(editForm.tokensPerSession || "20", 10) || 20;
    const sessions = editForm.sessions.split(",").map((s) => s.trim());
    try {
      await updateDoctor(editDoctor.id, {
        name: editForm.name,
        phone: editForm.phone,
        specialty: editForm.specialty,
        tokensPerSession: tokens,
        sessions,
        consultationFee: STANDARD_FEE,
        price: STANDARD_FEE,
        isAvailable: editForm.isAvailable,
      });
      toast.success("Doctor updated");
      setEditDoctor(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to update doctor");
    }
  }

  function handleToggleAvailability(doc: Doctor) {
    updateDoctor(doc.id, { isAvailable: !(doc.isAvailable ?? true) });
  }

  async function handleDelete(id: string) {
    try {
      await deleteDoctor(id);
      toast.success("Doctor deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete doctor");
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Your Doctors</h1>
          <p className="text-muted-foreground mt-1">
            {myDoctors.length} doctor{myDoctors.length === 1 ? "" : "s"} at your hospital
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setAddForm(EMPTY_ADD); }}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Doctor
            </Button>
          </DialogTrigger>
          <DialogContent showOverlay={false} className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Doctor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input
                  placeholder="Dr. John Smith"
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  placeholder="+91 98765 00000"
                  value={addForm.phone}
                  onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Specialty *</Label>
                <Input
                  placeholder="Cardiology"
                  value={addForm.specialty}
                  onChange={(e) => setAddForm((f) => ({ ...f, specialty: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tokens per Session</Label>
                <Input
                  type="number"
                  value={addForm.tokensPerSession}
                  onChange={(e) => setAddForm((f) => ({ ...f, tokensPerSession: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sessions (comma separated)</Label>
                <Input
                  value={addForm.sessions}
                  onChange={(e) => setAddForm((f) => ({ ...f, sessions: e.target.value }))}
                />
              </div>
              <div className="rounded-xl border border-teal-200 bg-teal-50 p-3">
                <p className="text-xs font-semibold text-teal-600 mb-1">Login Code</p>
                <p className="text-xs text-teal-700">A login code will be generated automatically once the doctor is added.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAdd}>Add Doctor</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Name</TableHead>
              <TableHead>Specialty</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Code</TableHead>
              <TableHead className="text-center">Available</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {myDoctors.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  No doctors yet — add your first one above.
                </TableCell>
              </TableRow>
            )}
            {myDoctors.map((doctor) => (
              <TableRow key={doctor.id}>
                <TableCell className="font-medium">{doctor.name}</TableCell>
                <TableCell><Badge variant="outline">{doctor.specialty}</Badge></TableCell>
                <TableCell className="text-muted-foreground text-sm">{doctor.phone ?? "—"}</TableCell>
                <TableCell>
                  <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{doctor.code ?? "—"}</span>
                </TableCell>
                <TableCell className="text-center">
                  <Switch checked={doctor.isAvailable ?? true} onCheckedChange={() => handleToggleAvailability(doctor)} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(doctor)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Doctor</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete <strong>{doctor.name}</strong>? All associated
                            sessions, tokens, and bookings will be removed.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(doctor.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editDoctor} onOpenChange={(open) => !open && setEditDoctor(null)}>
        <DialogContent showOverlay={false}>
          <DialogHeader>
            <DialogTitle>Edit Doctor: {editDoctor?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Specialty</Label>
              <Input value={editForm.specialty} onChange={(e) => setEditForm((f) => ({ ...f, specialty: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Tokens per Session</Label>
              <Input type="number" value={editForm.tokensPerSession} onChange={(e) => setEditForm((f) => ({ ...f, tokensPerSession: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Sessions (comma separated)</Label>
              <Input value={editForm.sessions} onChange={(e) => setEditForm((f) => ({ ...f, sessions: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={editForm.isAvailable} onCheckedChange={(v) => setEditForm((f) => ({ ...f, isAvailable: v }))} />
              <Label>Available for appointments</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDoctor(null)}>Cancel</Button>
            <Button onClick={handleEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
