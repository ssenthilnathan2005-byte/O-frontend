import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, LogOut, Loader2, Plus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import * as api from "../api";
import type { LabTest, LabBooking } from "../api";
import { useStore } from "../context/StoreContext";
import LabTokenPanel from "./LabTokenPanel";
import LabHomeCollectionSetting from "./LabHomeCollectionSetting";

const STATUS_OPTIONS: LabBooking["status"][] = [
  "booked", "technician_assigned", "sample_collected", "processing", "report_ready", "cancelled",
];

const STATUS_LABELS: Record<LabBooking["status"], string> = {
  booked: "Booked",
  technician_assigned: "Technician Assigned",
  sample_collected: "Sample Collected",
  processing: "Processing",
  report_ready: "Report Ready",
  cancelled: "Cancelled",
};

export default function LabDashboard() {
  const { user, logout } = useStore();
  const labName = (user as any)?.labName || "Your Lab";

  const [tab, setTab] = useState<"tokens" | "bookings" | "tests">("tokens");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-sm">{labName}</h1>
            <p className="text-xs text-gray-400">Lab Staff Dashboard</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={logout} className="gap-1.5">
          <LogOut className="w-3.5 h-3.5" /> Logout
        </Button>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setTab("tokens")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              tab === "tokens" ? "bg-teal-500 text-white" : "bg-white text-gray-600 border border-gray-200"
            }`}
          >
            Token Control
          </button>
          <button
            type="button"
            onClick={() => setTab("bookings")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              tab === "bookings" ? "bg-teal-500 text-white" : "bg-white text-gray-600 border border-gray-200"
            }`}
          >
            Bookings
          </button>
          <button
            type="button"
            onClick={() => setTab("tests")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              tab === "tests" ? "bg-teal-500 text-white" : "bg-white text-gray-600 border border-gray-200"
            }`}
          >
            Tests & Pricing
          </button>
        </div>

        {tab === "tokens" && <LabTokenPanel />}
        {tab === "bookings" && <BookingsTab />}
        {tab === "tests" && <LabHomeCollectionSetting />}
        {tab === "tests" && <TestsTab />}
      </div>
    </div>
  );
}

// ── Bookings tab ─────────────────────────────────────────────────────────────
function BookingsTab() {
  const [bookings, setBookings] = useState<LabBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.labs.myLabBookings().then(setBookings).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function handleStatusChange(booking: LabBooking, status: LabBooking["status"]) {
    setUpdatingId(booking.id);
    try {
      await api.labs.updateStatus(booking.id, { status });
      toast.success(`Status updated to "${STATUS_LABELS[status]}"`);
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <>
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 text-sm">{bookings.length} bookings</h2>
        <Button variant="ghost" size="sm" onClick={load} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading...
        </div>
      ) : bookings.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">No bookings yet.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Token</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Test</TableHead>
              <TableHead>Date / Session</TableHead>
              <TableHead>Collection</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="text-sm font-bold text-teal-700">{b.token_number != null ? `#${b.token_number}` : "—"}</TableCell>
                <TableCell>
                  <p className="font-medium text-sm">{b.patient_name}</p>
                  <p className="text-xs text-gray-400">{b.phone}</p>
                </TableCell>
                <TableCell className="text-sm">{b.test_name}</TableCell>
                <TableCell className="text-sm text-gray-500">{b.slot_date} · {api.labSessionLabel(b.slot_time)}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">
                    {b.collection_type === "home" ? "Home" : "Walk-in"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm font-medium">₹{b.price}</TableCell>
                <TableCell>
                  <select
                    value={b.status}
                    disabled={updatingId === b.id}
                    onChange={(e) => handleStatusChange(b, e.target.value as LabBooking["status"])}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-300 disabled:opacity-50"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
    </>
  );
}

// ── Tests & pricing tab ──────────────────────────────────────────────────────
function TestsTab() {
  const [tests, setTests] = useState<LabTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ testName: "", category: "blood", sampleType: "blood", reportHours: "24", price: "" });
  const [adding, setAdding] = useState(false);

  function load() {
    setLoading(true);
    api.labs.myTests().then(setTests).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function handleAdd() {
    if (!form.testName.trim() || !form.price) { toast.error("Test name and price are required"); return; }
    setAdding(true);
    try {
      await api.labs.addTest({
        testName: form.testName.trim(),
        category: form.category,
        sampleType: form.sampleType,
        reportHours: Number(form.reportHours) || 24,
        price: Number(form.price),
      });
      toast.success("Test added");
      setForm({ testName: "", category: "blood", sampleType: "blood", reportHours: "24", price: "" });
      setAddOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to add test");
    } finally {
      setAdding(false);
    }
  }

  async function handleTogglePrice(test: LabTest & { is_active?: boolean }, newPrice: string) {
    const price = Number(newPrice);
    if (!price || price <= 0) return;
    try {
      await api.labs.updateMyTest(test.id, { price });
      toast.success(`Price updated for ${test.name}`);
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to update price");
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 text-sm">{tests.length} tests offered</h2>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Test
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add a Test</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Test Name *</Label>
                <Input placeholder="e.g. Complete Blood Count (CBC)" value={form.testName}
                  onChange={(e) => setForm(f => ({ ...f, testName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input placeholder="e.g. blood, urine, hormone" value={form.category}
                  onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Sample Type</Label>
                <Input placeholder="e.g. blood, urine, saliva" value={form.sampleType}
                  onChange={(e) => setForm(f => ({ ...f, sampleType: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Report Time (hours)</Label>
                <Input type="number" placeholder="24" value={form.reportHours}
                  onChange={(e) => setForm(f => ({ ...f, reportHours: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Price (₹) *</Label>
                <Input type="number" placeholder="350" value={form.price}
                  onChange={(e) => setForm(f => ({ ...f, price: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={adding}>
                {adding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Add Test
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading...
        </div>
      ) : tests.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">No tests added yet. Click "Add Test" to get started.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Test</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Sample</TableHead>
              <TableHead>Report Time</TableHead>
              <TableHead>Price (₹)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tests.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium text-sm">{t.name}</TableCell>
                <TableCell className="text-sm text-gray-500">{t.category}</TableCell>
                <TableCell className="text-sm text-gray-500">{t.sample_type}</TableCell>
                <TableCell className="text-sm text-gray-500">{t.report_hours}h</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    defaultValue={t.price}
                    onBlur={(e) => handleTogglePrice(t, e.target.value)}
                    className="w-24 h-8 text-sm"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
