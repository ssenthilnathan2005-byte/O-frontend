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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  hospitalId: string;
  tokensPerSession: string;
  sessions: string;
  code: string;
};

type EditForm = {
  name: string;
  phone: string;
  specialty: string;
  hospitalId: string;
  tokensPerSession: string;
  sessions: string;
  code: string;
  isAvailable: boolean;
};

export default function AdminDoctors() {
  const { doctors, hospitals, addDoctor, deleteDoctor, updateDoctor } =
    useStore();
  const [addOpen, setAddOpen] = useState(false);
  const [editDoctor, setEditDoctor] = useState<Doctor | null>(null);
  const [addForm, setAddForm] = useState<AddForm>({
    name: "",
    phone: "",
    specialty: "",
    hospitalId: "",
    tokensPerSession: "20",
    sessions: "morning,afternoon",
    code: "",
  });
  const [editForm, setEditForm] = useState<EditForm>({
    name: "",
    phone: "",
    specialty: "",
    hospitalId: "",
    tokensPerSession: "20",
    sessions: "morning,afternoon",
    code: "",
    isAvailable: true,
  });

  function getHospitalName(hospitalId: string) {
    return hospitals.find((h) => h.id === hospitalId)?.name ?? "Unknown";
  }

  async function handleAdd() {
    if (!addForm.name || !addForm.specialty || !addForm.hospitalId) {
      toast.error("Name, specialty, and hospital are required");
      return;
    }
    const tokens = Number.parseInt(addForm.tokensPerSession, 10) || 20;
    const sessions = addForm.sessions
      .split(",")
      .map((s) => s.trim()) as Doctor["sessions"];
    try {
      const newDoc = await addDoctor({
        name: addForm.name,
        phone: addForm.phone,
        specialty: addForm.specialty,
        hospitalId: addForm.hospitalId,
        consultationFee: STANDARD_FEE,
        price: STANDARD_FEE,
        tokensPerSession: tokens,
        sessions,
        isAvailable: true,
      });

      if (addForm.code) {
        await updateDoctor(newDoc.id, { code: addForm.code });
      }

      toast.success(`Doctor ${newDoc.name} added with code ${addForm.code || newDoc.code}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to add doctor");
      return;
    }
    setAddForm({
      name: "",
      phone: "",
      specialty: "",
      hospitalId: "",
      tokensPerSession: "20",
      sessions: "morning,afternoon",
      code: "",
    });
    setAddOpen(false);
  }

  function openEdit(doc: Doctor) {
    setEditDoctor(doc);
    setEditForm({
      name: doc.name,
      phone: doc.phone ?? "",
      specialty: doc.specialty,
      hospitalId: doc.hospitalId,
      tokensPerSession: String(doc.tokensPerSession ?? 20),
      sessions: (doc.sessions ?? ["morning", "afternoon"]).join(","),
      code: doc.code ?? "",
      isAvailable: doc.isAvailable ?? true,
    });
  }

  function handleEdit() {
    if (!editDoctor) return;
    const tokens = Number.parseInt(editForm.tokensPerSession, 10) || 20;
    const sessions = editForm.sessions
      .split(",")
      .map((s) => s.trim()) as Doctor["sessions"];
    updateDoctor(editDoctor.id, {
      name: editForm.name,
      phone: editForm.phone,
      specialty: editForm.specialty,
      hospitalId: editForm.hospitalId,
      tokensPerSession: tokens,
      sessions,
      code: editForm.code || undefined,
      consultationFee: STANDARD_FEE,
      price: STANDARD_FEE,
      isAvailable: editForm.isAvailable,
    });
    toast.success("Doctor updated");
    setEditDoctor(null);
  }

  function handleToggleAvailability(doc: Doctor) {
    updateDoctor(doc.id, { isAvailable: !(doc.isAvailable ?? true) });
  }

  function handleDelete(id: string) {
    deleteDoctor(id);
    toast.success("Doctor deleted");
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Doctor Management</h1>
          <p className="text-muted-foreground mt-1">
            {doctors.length} doctors registered
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button
              className="flex items-center gap-2"
              data-ocid="admin.open_modal_button"
            >
              <Plus className="w-4 h-4" />
              Add Doctor
            </Button>
          </DialogTrigger>
          <DialogContent showOverlay={false} className="max-w-lg" data-ocid="admin.dialog">
            <DialogHeader>
              <DialogTitle>Add New Doctor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input
                  placeholder="Dr. John Smith"
                  value={addForm.name}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, name: e.target.value }))
                  }
                  data-ocid="admin.input"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  placeholder="+91 98765 00000"
                  value={addForm.phone}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  data-ocid="admin.input"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Specialty *</Label>
                <Input
                  placeholder="e.g. Cardiologist"
                  value={addForm.specialty}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, specialty: e.target.value }))
                  }
                  data-ocid="admin.input"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Hospital *</Label>
                <Select
                  value={addForm.hospitalId}
                  onValueChange={(v) =>
                    setAddForm((f) => ({ ...f, hospitalId: v }))
                  }
                >
                  <SelectTrigger data-ocid="admin.select">
                    <SelectValue placeholder="Select hospital" />
                  </SelectTrigger>
                  <SelectContent>
                    {hospitals.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tokens per Session</Label>
                <Input
                  type="number"
                  placeholder="20"
                  value={addForm.tokensPerSession}
                  onChange={(e) =>
                    setAddForm((f) => ({
                      ...f,
                      tokensPerSession: e.target.value,
                    }))
                  }
                  data-ocid="admin.input"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Login Code</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="Enter login code"
                    value={addForm.code}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, code: e.target.value }))
                    }
                    data-ocid="admin.input"
                  />
                  <Button
                    variant="secondary"
                    className="whitespace-nowrap"
                    onClick={() => {
                      if (!addForm.code) {
                        toast.error("Enter a login code before saving");
                        return;
                      }
                      toast.success("Login code saved for this doctor");
                    }}
                    data-ocid="admin.save_code_button"
                  >
                    Save Login Code
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border border-teal-200 bg-teal-50 p-3">
                <p className="text-xs font-semibold text-teal-600 mb-1">Login Code Preview</p>
                <code className="text-sm font-bold text-teal-700 tracking-widest">
                  {addForm.code || (addForm.name ? addForm.name.split(" ").map((w, i) => i < 2 ? w[0] : "")
                    .join("").toUpperCase() + ".CODE.01" : "Fill name to preview")}
                </code>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setAddOpen(false)}
                data-ocid="admin.cancel_button"
              >
                Cancel
              </Button>
              <Button onClick={handleAdd} data-ocid="admin.submit_button">
                Add Doctor
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 px-1 py-2 text-sm text-muted-foreground bg-muted/30 rounded-lg border border-border/50">
        <span>✏️</span>
        <span>
          Click the edit icon in the Actions column to modify doctor details.
          Changes are saved immediately.
        </span>
      </div>

      <div
        className="rounded-xl border border-border overflow-hidden bg-card"
        data-ocid="admin.table"
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Name</TableHead>
              <TableHead>Hospital</TableHead>
              <TableHead>Specialty</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Code</TableHead>
              <TableHead className="text-center">Available</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {doctors.map((doctor, idx) => (
              <TableRow key={doctor.id} data-ocid={`admin.item.${idx + 1}`}>
                <TableCell className="font-medium">{doctor.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {getHospitalName(doctor.hospitalId)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{doctor.specialty}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {doctor.phone ?? "—"}
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                    {doctor.code ?? "—"}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={doctor.isAvailable ?? true}
                    onCheckedChange={() => handleToggleAvailability(doctor)}
                    data-ocid="admin.switch"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(doctor)}
                      data-ocid="admin.edit_button"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          data-ocid="admin.delete_button"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent data-ocid="admin.dialog">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Doctor</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete{" "}
                            <strong>{doctor.name}</strong>? All associated
                            sessions, tokens, and bookings will be removed.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel data-ocid="admin.cancel_button">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(doctor.id)}
                            className="bg-destructive hover:bg-destructive/90"
                            data-ocid="admin.confirm_button"
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

      {/* Edit Dialog */}
      <Dialog
        open={!!editDoctor}
        onOpenChange={(open) => !open && setEditDoctor(null)}
      >
        <DialogContent showOverlay={false} className="max-w-lg" data-ocid="admin.dialog">
          <DialogHeader>
            <DialogTitle>Edit Doctor: {editDoctor?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, name: e.target.value }))
                }
                data-ocid="admin.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={editForm.phone}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, phone: e.target.value }))
                }
                data-ocid="admin.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Specialty</Label>
              <Input
                value={editForm.specialty}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, specialty: e.target.value }))
                }
                data-ocid="admin.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Hospital</Label>
              <Select
                value={editForm.hospitalId}
                onValueChange={(v) =>
                  setEditForm((f) => ({ ...f, hospitalId: v }))
                }
              >
                <SelectTrigger data-ocid="admin.select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hospitals.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tokens per Session</Label>
              <Input
                type="number"
                value={editForm.tokensPerSession}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, tokensPerSession: e.target.value }))
                }
                data-ocid="admin.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sessions</Label>
              <Input
                placeholder="morning,afternoon"
                value={editForm.sessions}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, sessions: e.target.value }))
                }
                data-ocid="admin.input"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={editForm.isAvailable}
                onCheckedChange={(v) =>
                  setEditForm((f) => ({ ...f, isAvailable: v }))
                }
                data-ocid="admin.switch"
              />
              <Label>Available for appointments</Label>
            </div>
            <div className="space-y-1.5">
              <Label>Login Code</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={editForm.code}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, code: e.target.value }))
                  }
                  data-ocid="admin.input"
                />
                <Button
                  variant="secondary"
                  className="whitespace-nowrap"
                  onClick={() => {
                    if (!editDoctor) {
                      toast.error("No doctor selected to save code");
                      return;
                    }
                    if (!editForm.code) {
                      toast.error("Enter a login code before saving");
                      return;
                    }
                    updateDoctor(editDoctor.id, { code: editForm.code });
                    toast.success("Login code saved for this doctor");
                  }}
                  data-ocid="admin.save_code_button"
                >
                  Save Login Code
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDoctor(null)}
              data-ocid="admin.cancel_button"
            >
              Cancel
            </Button>
            <Button onClick={handleEdit} data-ocid="admin.save_button">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
