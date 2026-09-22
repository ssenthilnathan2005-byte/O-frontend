import { useEffect, useState } from "react";
import { useStore } from "../../context/StoreContext";
import { Package, Plus, X, Pencil, Trash2, ArrowUp, ArrowDown, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getToken } from "../../api";

const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

type Item = {
  id: string; name: string; category: string; unit: string;
  quantity: number; min_quantity: number; purchase_price: number | null;
  supplier: string | null; location: string | null; notes: string | null;
};

const CATEGORIES = ["supplies","equipment","consumables","medicines","linen","cleaning","other"];
const EMPTY = { name:"", category:"supplies", unit:"units", quantity:"0", minQuantity:"5", purchasePrice:"", supplier:"", location:"", notes:"" };

const CAT_COLORS: Record<string,string> = {
  supplies:"bg-blue-50 text-blue-700", equipment:"bg-purple-50 text-purple-700",
  consumables:"bg-orange-50 text-orange-700", medicines:"bg-green-50 text-green-700",
  linen:"bg-pink-50 text-pink-700", cleaning:"bg-yellow-50 text-yellow-700",
  other:"bg-gray-100 text-gray-500",
};

export default function HAInventory() {
  const { user } = useStore();
  const hospitalId = user?.role === "hospital_admin" ? (user as any).hospitalId : "";

  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [loading, setLoading] = useState(false);
  const [txModal, setTxModal] = useState<{ item: Item; type: "in"|"out" } | null>(null);
  const [txQty, setTxQty] = useState("");
  const [txReason, setTxReason] = useState("");
  const [historyModal, setHistoryModal] = useState<Item | null>(null);
  const [historyRows, setHistoryRows] = useState<Array<{ id:string; type:string; quantity:number; reason:string|null; created_at:string }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function apiFetch(path: string, method="GET", body?: any) {
    const res = await fetch(`${BASE}${path}`, {
      method, headers: { "Content-Type":"application/json", Authorization:`Bearer ${getToken()}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  }

  async function load() {
    try { setItems(await apiFetch("/inventory")); } catch {}
  }

  async function openHistory(item: Item) {
    setHistoryModal(item);
    setHistoryLoading(true);
    try { setHistoryRows(await apiFetch(`/inventory/${item.id}/transactions`)); }
    catch { setHistoryRows([]); }
    finally { setHistoryLoading(false); }
  }

  useEffect(() => { if (hospitalId) load(); }, [hospitalId]);

  function openAdd() { setForm({ ...EMPTY }); setEditId(null); setShowForm(true); }
  function openEdit(item: Item) {
    setForm({ name:item.name, category:item.category, unit:item.unit,
      quantity:String(item.quantity), minQuantity:String(item.min_quantity),
      purchasePrice:item.purchase_price ? String(item.purchase_price) : "",
      supplier:item.supplier||"", location:item.location||"", notes:item.notes||"" });
    setEditId(item.id); setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const payload = { ...form, quantity:Number(form.quantity), minQuantity:Number(form.minQuantity),
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null };
      if (editId) await apiFetch(`/inventory/${editId}`, "PATCH", payload);
      else await apiFetch("/inventory", "POST", payload);
      setShowForm(false); await load();
    } catch {} finally { setLoading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this item?")) return;
    try { await apiFetch(`/inventory/${id}`, "DELETE"); await load(); } catch {}
  }

  async function handleTransaction() {
    if (!txModal || !txQty) return;
    setLoading(true);
    try {
      await apiFetch(`/inventory/${txModal.item.id}/transaction`, "POST",
        { type: txModal.type, quantity: Number(txQty), reason: txReason });
      setTxModal(null); setTxQty(""); setTxReason(""); await load();
    } catch {} finally { setLoading(false); }
  }

  const filtered = items.filter(i =>
    (filter === "all" || i.category === filter) &&
    (i.name.toLowerCase().includes(search.toLowerCase()) ||
     (i.supplier||"").toLowerCase().includes(search.toLowerCase()))
  );

  const lowStock = items.filter(i => i.quantity <= i.min_quantity).length;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-teal-600" />
          <h1 className="text-xl font-bold">Inventory</h1>
          {lowStock > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
              {lowStock} low stock
            </span>
          )}
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter("all")}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter==="all" ? "bg-teal-600 text-white" : "bg-muted text-muted-foreground"}`}>
          All ({items.length})
        </button>
        {CATEGORIES.filter(c => items.some(i => i.category === c)).map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${filter===c ? "bg-teal-600 text-white" : "bg-muted text-muted-foreground"}`}>
            {c} ({items.filter(i => i.category === c).length})
          </button>
        ))}
      </div>

      <Input placeholder="Search by name or supplier..." value={search}
        onChange={e => setSearch(e.target.value)} className="max-w-sm" />

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No items found.</div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {["Item","Category","Stock","Min","Supplier","Location",""].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const isLow = item.quantity <= item.min_quantity;
                return (
                  <tr key={item.id} className="border-t hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.name}</p>
                      {item.purchase_price && <p className="text-xs text-muted-foreground">₹{item.purchase_price}/{item.unit}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${CAT_COLORS[item.category]||"bg-gray-100 text-gray-500"}`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${isLow ? "text-red-600" : "text-gray-800"}`}>
                        {item.quantity} {item.unit}
                      </span>
                      {isLow && <p className="text-xs text-red-400">Low stock</p>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{item.min_quantity} {item.unit}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.supplier||"—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.location||"—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => { setTxModal({ item, type:"in" }); setTxQty(""); setTxReason(""); }}
                          className="p-1.5 rounded hover:bg-green-50 transition-colors" title="Stock In">
                          <ArrowDown className="w-3.5 h-3.5 text-green-600" />
                        </button>
                        <button onClick={() => { setTxModal({ item, type:"out" }); setTxQty(""); setTxReason(""); }}
                          className="p-1.5 rounded hover:bg-orange-50 transition-colors" title="Stock Out">
                          <ArrowUp className="w-3.5 h-3.5 text-orange-500" />
                        </button>
                        <button onClick={() => openHistory(item)}
                          className="p-1.5 rounded hover:bg-blue-50 transition-colors" title="History">
                          <History className="w-3.5 h-3.5 text-blue-500" />
                        </button>
                        <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-muted transition-colors">
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-red-50 transition-colors">
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-lg">{editId ? "Edit Item" : "Add Item"}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {[
                { label:"Item Name *", key:"name", placeholder:"e.g. Surgical Gloves" },
                { label:"Unit", key:"unit", placeholder:"e.g. boxes, units, kg" },
                { label:"Quantity", key:"quantity", placeholder:"Current stock" },
                { label:"Min Quantity (alert threshold)", key:"minQuantity", placeholder:"5" },
                { label:"Purchase Price (₹)", key:"purchasePrice", placeholder:"Per unit cost" },
                { label:"Supplier", key:"supplier", placeholder:"Supplier name" },
                { label:"Storage Location", key:"location", placeholder:"e.g. Store Room 1" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">{label}</label>
                  <Input placeholder={placeholder} value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white">
                  {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Additional notes..."
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={loading}
                className="px-4 py-2 rounded-lg text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors disabled:opacity-50">
                {loading ? "Saving..." : editId ? "Update" : "Add Item"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock In/Out Modal */}
      {txModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-lg">
                {txModal.type === "in" ? "Stock In" : "Stock Out"} — {txModal.item.name}
              </h2>
              <button onClick={() => setTxModal(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-gray-500">Current stock: <span className="font-semibold text-gray-800">{txModal.item.quantity} {txModal.item.unit}</span></p>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Quantity *</label>
                <Input type="number" min="1" placeholder="Enter quantity"
                  value={txQty} onChange={e => setTxQty(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Reason</label>
                <Input placeholder="e.g. Purchase order, Used in surgery"
                  value={txReason} onChange={e => setTxReason(e.target.value)} />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button onClick={() => setTxModal(null)}
                className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleTransaction} disabled={loading}
                className={`px-4 py-2 rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50 ${txModal.type==="in" ? "bg-green-600 hover:bg-green-700" : "bg-orange-500 hover:bg-orange-600"}`}>
                {loading ? "Saving..." : txModal.type === "in" ? "Add Stock" : "Remove Stock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock History Modal */}
      {historyModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
              <h2 className="font-semibold text-lg">Stock History — {historyModal.name}</h2>
              <button onClick={() => setHistoryModal(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4">
              {historyLoading ? (
                <p className="text-sm text-gray-500">Loading...</p>
              ) : historyRows.length === 0 ? (
                <p className="text-sm text-gray-500">No stock movements recorded yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 pr-2">Type</th>
                      <th className="py-2 pr-2">Qty</th>
                      <th className="py-2 pr-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map(row => (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="py-2 pr-2 text-gray-500 whitespace-nowrap">
                          {new Date(row.created_at).toLocaleString()}
                        </td>
                        <td className="py-2 pr-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.type === "in" ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-600"}`}>
                            {row.type === "in" ? "Stock In" : "Stock Out"}
                          </span>
                        </td>
                        <td className="py-2 pr-2 font-medium">{row.quantity}</td>
                        <td className="py-2 pr-2 text-gray-600">{row.reason || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-6 py-4 border-t flex justify-end">
              <button onClick={() => setHistoryModal(null)}
                className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
