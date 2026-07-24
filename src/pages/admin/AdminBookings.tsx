import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookOpen, Trash2, Download, Settings2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { useStore } from "../../context/StoreContext";
import { useState, useEffect, useCallback } from "react";

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  unvisited: "bg-amber-100 text-amber-700",
  cancelled:  "bg-red-100 text-red-700",
};

const API = (import.meta.env.VITE_API_URL ?? "").replace(/\/api$/, "");

interface CleanupConfig {
  thresholdCount: number;
  olderThanDays: number;
}

interface CleanupLog {
  id: number;
  ran_at: string;
  triggered_by: string;
  bookings_found: number;
  bookings_deleted: number;
  export_file: string | null;
  skipped_reason: string | null;
}

export default function AdminBookings() {
  const { bookings } = useStore();
  const recentBookings = [...bookings].reverse().slice(0, 100);

  const [config, setConfig]           = useState<CleanupConfig | null>(null);
  const [logs, setLogs]               = useState<CleanupLog[]>([]);
  const [editThreshold, setEditThreshold] = useState("");
  const [editDays, setEditDays]       = useState("");
  const [showConfig, setShowConfig]   = useState(false);
  const [runStatus, setRunStatus]     = useState<null | "loading" | "success" | "error">(null);
  const [runMessage, setRunMessage]   = useState("");
  const [lastFile, setLastFile]       = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  const token = localStorage.getItem("db_jwt") ?? "";

  const fetchConfig = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/admin/cleanup/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      setConfig(data);
      setEditThreshold(String(data.thresholdCount));
      setEditDays(String(data.olderThanDays));
    } catch {}
  }, [token]);

  const fetchLogs = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/admin/cleanup/logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      setLogs(data);
      // Pick last successful export file
      const last = data.find((l: CleanupLog) => l.export_file);
      if (last) setLastFile(last.export_file);
    } catch {}
  }, [token]);

  useEffect(() => {
    fetchConfig();
    fetchLogs();
  }, [fetchConfig, fetchLogs]);

  async function runCleanup() {
    setRunStatus("loading");
    setRunMessage("");
    try {
      const r = await fetch(`${API}/api/admin/cleanup/run`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Unknown error");
      if (data.result?.skipped) {
        setRunStatus("error");
        setRunMessage(data.result.reason);
      } else {
        setRunStatus("success");
        setRunMessage(`✓ Deleted ${data.result.deleted} bookings. Exported as ${data.result.file}`);
        setLastFile(data.result.file);
        fetchLogs();
      }
    } catch (err: any) {
      setRunStatus("error");
      setRunMessage(err.message);
    }
  }

  async function saveConfig() {
    setSavingConfig(true);
    try {
      const r = await fetch(`${API}/api/admin/cleanup/config`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          thresholdCount: parseInt(editThreshold),
          olderThanDays:  parseInt(editDays),
        }),
      });
      const data = await r.json();
      setConfig(data.config);
      setShowConfig(false);
    } catch {}
    setSavingConfig(false);
  }

  function downloadArchive() {
    if (!lastFile) return;
    window.open(`${API}/api/admin/cleanup/export/${lastFile}`, "_blank");
  }

  return (
    <div className="p-8">
      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Booking Management</h1>
          <p className="text-muted-foreground mt-1">
            Showing last {Math.min(bookings.length, 100)} bookings (read-only)
          </p>
        </div>

        {/* ── Cleanup Controls ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Config button */}
          <button
            onClick={() => setShowConfig((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
          >
            <Settings2 className="w-4 h-4" />
            {config
              ? `Auto-clean: ${config.thresholdCount} patients / ${config.olderThanDays} days`
              : "Cleanup Config"}
          </button>

          {/* Download last archive */}
          <button
            onClick={downloadArchive}
            disabled={!lastFile}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Download Archive
          </button>

          {/* Run cleanup now */}
          <button
            onClick={runCleanup}
            disabled={runStatus === "loading"}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60"
          >
            {runStatus === "loading"
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : <Trash2 className="w-4 h-4" />}
            {runStatus === "loading" ? "Running..." : "Run Cleanup Now"}
          </button>
        </div>
      </div>

      {/* ── Run status message ── */}
      {runMessage && (
        <div className={`mb-4 flex items-start gap-2 rounded-lg px-4 py-3 text-sm ${
          runStatus === "success"
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-amber-50 text-amber-700 border border-amber-200"
        }`}>
          {runStatus === "success"
            ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
          {runMessage}
        </div>
      )}

      {/* ── Config Panel ── */}
      {showConfig && (
        <div className="mb-6 rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> Auto-Cleanup Settings
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">
                Delete after this many patients
              </label>
              <input
                type="number"
                min={1}
                value={editThreshold}
                onChange={(e) => setEditThreshold(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Cleanup runs when this many old bookings accumulate
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-muted-foreground">
                Booking age (days) before eligible
              </label>
              <input
                type="number"
                min={1}
                value={editDays}
                onChange={(e) => setEditDays(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Only bookings older than this many days get deleted
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveConfig}
              disabled={savingConfig}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {savingConfig ? "Saving..." : "Save Settings"}
            </button>
            <button
              onClick={() => setShowConfig(false)}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Cleanup Logs ── */}
      {logs.length > 0 && (
        <div className="mb-6 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/40">
            <h2 className="text-sm font-semibold">Recent Cleanup Runs</h2>
          </div>
          <div className="divide-y divide-border">
            {logs.slice(0, 5).map((log) => (
              <div key={log.id} className="px-4 py-3 flex items-center justify-between gap-4 text-sm flex-wrap">
                <div className="flex items-center gap-3">
                  {log.bookings_deleted > 0
                    ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    : <XCircle className="w-4 h-4 text-amber-400 shrink-0" />}
                  <div>
                    <p className="font-medium">
                      {log.bookings_deleted > 0
                        ? `Deleted ${log.bookings_deleted} bookings`
                        : "Skipped"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {log.skipped_reason ?? log.export_file ?? ""}
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{new Date(log.ran_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
                  <p className="capitalize">{log.triggered_by.replace("_", " ")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bookings Table ── */}
      {recentBookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <BookOpen className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No bookings yet</p>
          <p className="text-sm mt-1">Bookings will appear after patients book tokens</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Token #</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Hospital</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentBookings.map((booking, idx) => (
                <TableRow key={booking.id} data-ocid={`admin.item.${idx + 1}`}>
                  <TableCell className="font-mono font-bold text-primary">
                    #{booking.tokenNumber}
                  </TableCell>
                  <TableCell className="font-medium">{booking.patientName}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{booking.doctorName}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{booking.hospitalName}</TableCell>
                  <TableCell className="text-sm">{booking.date}</TableCell>
                  <TableCell className="text-sm capitalize">{booking.session}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_COLORS[booking.status] ?? "bg-gray-100 text-gray-700"
                    }`}>
                      {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
