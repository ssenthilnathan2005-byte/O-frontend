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
  code: string;
  photo: string | null;
};

const EMPTY_ADD: AddForm = {
  name: "", phone: "", specialty: "", tokensPerSession: "20", sessions: "morning,afternoon",
};

const SPECIALTIES = [
  "General Practitioner (GP)", "Internist", "Pediatrician / Child Specialist",
  "Geriatrician", "Family Physician", "Cardiologist", "Cardiac Surgeon",
  "Vascular Surgeon", "Neurologist", "Neurosurgeon", "Psychiatrist",
  "Addiction Medicine Specialist", "Pulmonologist", "Gastroenterologist",
  "Hepatologist", "Endocrinologist / Diabetologist", "Nephrologist",
  "Urologist", "Gynecologist / Obstetrician", "Orthopedic Surgeon",
  "Dermatologist", "Ophthalmologist", "ENT Specialist", "Dentist / Oral Surgeon",
  "Rheumatologist", "Oncologist", "Hematologist", "Allergist / Immunologist",
  "Physiotherapist / Rehabilitation", "Pain Management Specialist",
  "Infectious Disease Specialist", "Sleep Medicine Physician", "Neonatologist",
  "Radiologist", "Pathologist", "General Surgeon", "Plastic Surgeon",
  "Pediatric Surgeon", "Colorectal Surgeon", "Thoracic Surgeon",
];

export default function HADoctors() {
  const { doctors, user, addDoctor, deleteDoctor, updateDoctor } = useStore();
  const hospitalId = user && user.role === "hospital_admin" ? user.hospitalId : "";
  const myDoctors = doctors.filter((d) => d.hospitalId === hospitalId);

  const [addOpen, setAddOpen] = useState(false);
  const [editDoctor, setEditDoctor] = useState<Doctor | null>(null);
  const [addSpSearch, setAddSpSearch] = useState("");
  const [addSpOpen, setAddSpOpen] = useState(false);
  const [editSpSearch, setEditSpSearch] = useState("");
  const [editSpOpen, setEditSpOpen] = useState(false);
  const [addSpecialtySearch, setAddSpecialtySearch] = useState("");
  const [addSpecialtyOpen, setAddSpecialtyOpen] = useState(false);
  const [editSpecialtySearch, setEditSpecialtySearch] = useState("");
  const [editSpecialtyOpen, setEditSpecialtyOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(EMPTY_ADD);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "", phone: "", specialty: "", tokensPerSession: "20",
    sessions: "morning,afternoon", isAvailable: true, code: "", photo: null,
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
      code: doc.code ?? "",
      photo: doc.photo ?? null,
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
        photo: editForm.photo ?? "",
      });
      toast.success("Doctor updated");
      setEditDoctor(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to update doctor");
    }
  }

  async function handleSaveCode() {
    if (!editDoctor) return;
    if (!editForm.code) {
      toast.error("Login code cannot be empty");
      return;
    }
    await updateDoctor(editDoctor.id, { code: editForm.code.toUpperCase() });
    toast.success("Login code saved");
    setEditDoctor(null);
  }

  async function handleSaveCode() {
    if (!editDoctor) return;
    if (!editForm.code) {
      toast.error("Login code cannot be empty");
      return;
    }
    await updateDoctor(editDoctor.id, { code: editForm.code.toUpperCase() });
    toast.success("Login code saved");
    setEditDoctor(null);
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
                <div className="relative">
                  <Input
                    placeholder="Search specialty..."
                    value={addSpSearch || addForm.specialty}
                    onFocus={() => { setAddSpOpen(true); setAddSpSearch(""); }}
                    onChange={(e) => { setAddSpSearch(e.target.value); setAddForm((f) => ({ ...f, specialty: e.target.value })); setAddSpOpen(true); }}
                    onBlur={() => setTimeout(() => setAddSpOpen(false), 150)}
                  />
                  {addSpOpen && (
                    <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                      {SPECIALTIES.filter((s) => s.toLowerCase().includes((addSpSearch || addForm.specialty).toLowerCase())).map((s) => (
                        <button key={s} type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                          onMouseDown={() => { setAddForm((f) => ({ ...f, specialty: s })); setAddSpSearch(""); setAddSpOpen(false); }}>
                          {s}
                        </button>
                      ))}
                      {SPECIALTIES.filter((s) => s.toLowerCase().includes((addSpSearch || addForm.specialty).toLowerCase())).length === 0 && (
                        <p className="px-3 py-2 text-sm text-muted-foreground">No match — will save as typed</p>
                      )}
                    </div>
                  )}
                </div>
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
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {doctor.photo ? (
                      <img src={doctor.photo} alt={doctor.name} className="w-8 h-8 rounded-full object-cover border shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                        {doctor.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {doctor.name}
                  </div>
                </TableCell>
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
              <div className="relative">
                <Input
                  placeholder="Search or type specialty..."
                  value={editSpecialtySearch || editForm.specialty}
                  onFocus={() => { setEditSpecialtyOpen(true); setEditSpecialtySearch(""); }}
                  onChange={(e) => { setEditSpecialtySearch(e.target.value); setEditForm((f) => ({ ...f, specialty: e.target.value })); setEditSpecialtyOpen(true); }}
                  onBlur={() => setTimeout(() => setEditSpecialtyOpen(false), 150)}
                />
                {editSpecialtyOpen && (
                  <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                    {SPECIALTIES.filter((s) => s.toLowerCase().includes((editSpecialtySearch || editForm.specialty).toLowerCase())).map((s) => (
                      <button
                        key={s} type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                        onMouseDown={() => { setEditForm((f) => ({ ...f, specialty: s })); setEditSpecialtySearch(""); setEditSpecialtyOpen(false); }}
                      >
                        {s}
                      </button>
                    ))}
                    {SPECIALTIES.filter((s) => s.toLowerCase().includes((editSpecialtySearch || editForm.specialty).toLowerCase())).length === 0 && (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No match — will use as typed</p>
                    )}
                  </div>
                )}
              </div>
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
            <div className="space-y-1.5">
              <Label>Doctor Photo</Label>
              <div className="flex items-center gap-3">
                {editForm.photo && (
                  <img
                    src={editForm.photo}
                    alt="preview"
                    className="w-14 h-14 rounded-full object-cover border"
                  />
                )}
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-input bg-background hover:bg-muted transition-colors">
                    {editForm.photo ? "Change Photo" : "Upload Photo"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () =>
                        setEditForm((f) => ({ ...f, photo: reader.result as string }));
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
                {editForm.photo && (
                  <button
                    type="button"
                    className="text-xs text-destructive hover:underline"
                    onClick={() => setEditForm((f) => ({ ...f, photo: null }))}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Login Code</Label>
              <Input
                className="font-mono"
                value={editForm.code}
                onChange={(e) => setEditForm((f) => ({ ...f, code: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDoctor(null)}>Cancel</Button>
            <div className="flex items-center gap-2">
              <Button onClick={handleSaveCode} variant="secondary">Save Code</Button>
              <Button onClick={handleEdit}>Save Changes</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
