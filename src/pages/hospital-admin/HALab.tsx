import { useEffect, useState } from "react";
import { useStore } from "../../context/StoreContext";
import { FlaskConical, Plus, X, Trash2, CheckCircle, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getToken } from "../../api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

type LabTest = {
  id: string; name: string; category: string; sample_type: string;
  report_hours: number; price: number; is_active: number;
};

type LabOrder = {
  id: string; patient_name: string; doctor_name: string | null;
  test_name: string; status: string; priority: string;
  notes: string | null; result_value: string | null; ordered_at: string;
};

const STATUS_FILTERS = ["ordered","report_ready","cancelled"];
const STATUS_COLORS: Record<string,string> = {
  ordered:"bg-blue-50 text-blue-700",
  sample_collected:"bg-blue-50 text-blue-700",
  processing:"bg-blue-50 text-blue-700",
  report_ready:"bg-green-50 text-green-700",
  cancelled:"bg-gray-100 text-gray-400",
};
const STATUS_LABELS: Record<string,string> = {
  ordered:"ordered", sample_collected:"ordered", processing:"ordered",
  report_ready:"report ready", cancelled:"cancelled",
};
const CATEGORIES = ["general","haematology","biochemistry","microbiology","radiology","pathology","cardiology","other"];
const SAMPLE_TYPES = ["blood","urine","stool","sputum","swab","tissue","other"];
const EMPTY_TEST = { name:"", category:"general", sampleType:"blood", reportHours:"24", price:"0" };
const EMPTY_ORDER = { patientName:"", doctorName:"", testId:"", priority:"normal", notes:"" };

export default function HALab() {
  const { user } = useStore();
  const hospitalId = user?.role === "hospital_admin" ? (user as any).hospitalId : "";

  const [tab, setTab] = useState<"orders"|"tests">("orders");
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [tests, setTests] = useState<LabTest[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showTestForm, setShowTestForm] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [testForm, setTestForm] = useState({ ...EMPTY_TEST });
  const [orderForm, setOrderForm] = useState({ ...EMPTY_ORDER });
  const [resultModal, setResultModal] = useState<LabOrder | null>(null);
  const [resultValue, setResultValue] = useState("");
  const [loading, setLoading] = useState(false);

  async function apiFetch(path: string, method="GET", body?: any) {
    const res = await fetch(`${BASE}${path}`, {
      method, headers: { "Content-Type":"application/json", Authorization:`Bearer ${getToken()}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  }

  async function loadOrders() {
    try { setOrders(await apiFetch("/hospital-lab/orders")); } catch {}
  }
  async function loadTests() {
    try { setTests(await apiFetch("/hospital-lab/tests")); } catch {}
  }

  useEffect(() => { if (hospitalId) { loadOrders(); loadTests(); } }, [hospitalId]);

  async function handleAddTest() {
    if (!testForm.name.trim()) return;
    setLoading(true);
    try {
      await apiFetch("/hospital-lab/tests", "POST", {
        name: testForm.name, category: testForm.category,
        sampleType: testForm.sampleType, reportHours: Number(testForm.reportHours),
        price: Number(testForm.price),
      });
      setShowTestForm(false); setTestForm({ ...EMPTY_TEST }); await loadTests();
    } catch {} finally { setLoading(false); }
  }

  async function handleAddOrder() {
    if (!orderForm.patientName.trim() || !orderForm.testId) return;
    setLoading(true);
    try {
      const test = tests.find(t => t.id === orderForm.testId);
      await apiFetch("/hospital-lab/orders", "POST", {
        patientName: orderForm.patientName, doctorName: orderForm.doctorName||null,
        testId: orderForm.testId, testName: test?.name||"",
        priority: orderForm.priority, notes: orderForm.notes||null,
      });
      setShowOrderForm(false); setOrderForm({ ...EMPTY_ORDER }); await loadOrders();
    } catch {} finally { setLoading(false); }
  }

  function handleAddResult(order: LabOrder) {
    setResultModal(order); setResultValue(order.result_value || "");
  }

  async function handleCancelOrder(order: LabOrder) {
    if (!confirm(`Cancel the ${order.test_name} order for ${order.patient_name}?`)) return;
    try { await apiFetch(`/hospital-lab/orders/${order.id}`, "PATCH", { status: "cancelled" }); await loadOrders(); } catch {}
  }

  async function handleReportReady() {
    if (!resultModal) return;
    setLoading(true);
    try {
      await apiFetch(`/hospital-lab/orders/${resultModal.id}`, "PATCH",
        { status: "report_ready", resultValue });
      setResultModal(null); await loadOrders();
    } catch {} finally { setLoading(false); }
  }

  async function handleDeleteTest(id: string) {
    if (!confirm("Delete this test?")) return;
    try { await apiFetch(`/hospital-lab/tests/${id}`, "DELETE"); await loadTests(); } catch {}
  }

  const filteredOrders = orders.filter(o => {
    const matchesStatus = statusFilter === "all"
      ? true
      : statusFilter === "ordered"
        ? ["ordered","sample_collected","processing"].includes(o.status)
        : o.status === statusFilter;
    return matchesStatus &&
      (o.patient_name.toLowerCase().includes(search.toLowerCase()) ||
       o.test_name.toLowerCase().includes(search.toLowerCase()));
  });

  const counts = {
    ordered: orders.filter(o => ["ordered","sample_collected","processing"].includes(o.status)).length,
    report_ready: orders.filter(o => o.status === "report_ready").length,
    cancelled: orders.filter(o => o.status === "cancelled").length,
  } as Record<string,number>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-teal-600" />
          <h1 className="text-xl font-bold">Laboratory</h1>
          {counts["ordered"] > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
              {counts["ordered"]} pending
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {tab === "orders" && (
            <button onClick={() => setShowOrderForm(true)}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> New Order
            </button>
          )}
          {tab === "tests" && (
            <button onClick={() => setShowTestForm(true)}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> Add Test
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["orders","tests"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${tab===t ? "bg-teal-600 text-white" : "bg-muted text-muted-foreground"}`}>
            {t === "orders" ? `Orders (${orders.length})` : `Test Catalog (${tests.length})`}
          </button>
        ))}
      </div>

      {tab === "orders" && (
        <>
          {/* Status filter */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setStatusFilter("all")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter==="all" ? "bg-teal-600 text-white" : "bg-muted text-muted-foreground"}`}>
              All ({orders.length})
            </button>
            {STATUS_FILTERS.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${statusFilter===s ? "bg-teal-600 text-white" : "bg-muted text-muted-foreground"}`}>
                {STATUS_LABELS[s]} ({counts[s]||0})
              </button>
            ))}
          </div>

          <Input placeholder="Search patient or test..." value={search}
            onChange={e => setSearch(e.target.value)} className="max-w-sm" />

          {filteredOrders.length === 0 ? (
            <div className="text-center py-16 text-gray-400">No orders found.</div>
          ) : (
            <div className="space-y-2">
              {filteredOrders.map(order => (
                <div key={order.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800">{order.patient_name}</p>
                        {order.priority === "urgent" && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">Urgent</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{order.test_name}</p>
                      {order.doctor_name && <p className="text-xs text-gray-400">Dr. {order.doctor_name}</p>}
                      {order.result_value && (
                        <p className="text-xs text-green-700 mt-1 font-medium">Result: {order.result_value}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{new Date(order.ordered_at).toLocaleString()}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[order.status]||""}`}>
                        {STATUS_LABELS[order.status] || order.status.replace(/_/g," ")}
                      </span>
                      {order.status !== "report_ready" && order.status !== "cancelled" && (
                        <div className="flex gap-1.5">
                          <button onClick={() => handleAddResult(order)}
                            className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors">
                            <CheckCircle className="w-3 h-3" /> Add Result
                          </button>
                          <button onClick={() => handleCancelOrder(order)}
                            className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                            <XCircle className="w-3 h-3" /> Cancel
                          </button>
                        </div>
                      )}
                      {order.status === "report_ready" && (
                        <button onClick={() => handleAddResult(order)}
                          className="text-xs text-teal-600 hover:underline">Edit result</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "tests" && (
        <div className="rounded-xl border overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {["Test Name","Category","Sample","TAT","Price",""].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tests.length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">No tests added yet.</td></tr>
              )}
              {tests.map(t => (
                <tr key={t.id} className="border-t hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{t.category}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{t.sample_type}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.report_hours}h</td>
                  <td className="px-4 py-3 text-muted-foreground">₹{t.price}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDeleteTest(t.id)} className="p-1.5 rounded hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Test Modal */}
      {showTestForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-lg">Add Lab Test</h2>
              <button onClick={() => setShowTestForm(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Test Name *</label>
                <Input placeholder="e.g. Complete Blood Count" value={testForm.name}
                  onChange={e => setTestForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Category</label>
                  <select value={testForm.category} onChange={e => setTestForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-white">
                    {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Sample Type</label>
                  <select value={testForm.sampleType} onChange={e => setTestForm(f => ({ ...f, sampleType: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-white">
                    {SAMPLE_TYPES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">TAT (hours)</label>
                  <Input type="number" value={testForm.reportHours}
                    onChange={e => setTestForm(f => ({ ...f, reportHours: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Price (₹)</label>
                  <Input type="number" value={testForm.price}
                    onChange={e => setTestForm(f => ({ ...f, price: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button onClick={() => setShowTestForm(false)}
                className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50">Cancel</button>
              <button onClick={handleAddTest} disabled={loading}
                className="px-4 py-2 rounded-lg text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium disabled:opacity-50">
                {loading ? "Saving..." : "Add Test"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Order Modal */}
      {showOrderForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-lg">New Lab Order</h2>
              <button onClick={() => setShowOrderForm(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Patient Name *</label>
                <Input placeholder="Patient name" value={orderForm.patientName}
                  onChange={e => setOrderForm(f => ({ ...f, patientName: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Doctor Name</label>
                <Input placeholder="Ordering doctor" value={orderForm.doctorName}
                  onChange={e => setOrderForm(f => ({ ...f, doctorName: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Test *</label>
                <select value={orderForm.testId} onChange={e => setOrderForm(f => ({ ...f, testId: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white">
                  <option value="">Select test</option>
                  {tests.filter(t => t.is_active).map(t => (
                    <option key={t.id} value={t.id}>{t.name} — ₹{t.price}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Priority</label>
                <select value={orderForm.priority} onChange={e => setOrderForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white">
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Notes</label>
                <textarea value={orderForm.notes} onChange={e => setOrderForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Clinical notes..."
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button onClick={() => setShowOrderForm(false)}
                className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50">Cancel</button>
              <button onClick={handleAddOrder} disabled={loading}
                className="px-4 py-2 rounded-lg text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium disabled:opacity-50">
                {loading ? "Saving..." : "Create Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {resultModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-lg">Enter Result</h2>
              <button onClick={() => setResultModal(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-gray-500">{resultModal.patient_name} — {resultModal.test_name}</p>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Result Value</label>
                <textarea value={resultValue} onChange={e => setResultValue(e.target.value)}
                  rows={3} placeholder="e.g. Hb: 13.2 g/dL, WBC: 7500..."
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button onClick={() => setResultModal(null)}
                className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50">Cancel</button>
              <button onClick={handleReportReady} disabled={loading}
                className="px-4 py-2 rounded-lg text-sm bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-50">
                {loading ? "Saving..." : "Mark Report Ready"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
