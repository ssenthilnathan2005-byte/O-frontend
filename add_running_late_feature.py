"""
Adds a "Running late?" feature:
- Patient can tap a button on the Token Tracker page and pick an ETA.
- This is saved on the booking and broadcast over the existing session
  WebSocket, and also picked up by the doctor dashboard's normal polling.
- Doctor dashboard shows a small badge next to the patient's name.

Run this from the O-frontend directory:
    python3 add_running_late_feature.py
"""
import os

BACKEND_SRC = "../O-Backend/O backend/src"


def patch(path, replacements, label):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    for old, new, expected_count in replacements:
        count = content.count(old)
        assert count == expected_count, (
            f"[{label}] expected {expected_count} occurrence(s) of anchor, found {count}:\n{old[:120]}"
        )
        content = content.replace(old, new)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"✓ patched {path}")


# ── 1. Backend: db schema migration ─────────────────────────────────────────
patch(
    os.path.join(BACKEND_SRC, "db/init.js"),
    [(
        '  "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE",',
        '  "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE",\n'
        '  "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS late_flag INTEGER NOT NULL DEFAULT 0",\n'
        '  "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS late_eta_minutes INTEGER",\n'
        '  "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS late_marked_at TIMESTAMPTZ",',
        1,
    )],
    "init.js",
)

# ── 2. Backend: bookings.js — include new columns + add mark-late route ────
NEW_ROUTE = '''
// ── POST mark running late ────────────────────────────────────────────────────
router.post("/:id/mark-late", requireAuth, async (req, res) => {
  if (req.user.role !== "patient")
    return res.status(403).json({ error: "Only patients can mark themselves as late" });

  const etaMinutes = Number(req.body.etaMinutes);
  if (!Number.isInteger(etaMinutes) || etaMinutes <= 0 || etaMinutes > 180)
    return res.status(400).json({ error: "etaMinutes must be a positive integer (max 180 minutes)" });

  try {
    const { rows } = await pool.query(
      "SELECT * FROM bookings WHERE id=$1 AND patient_id=$2",
      [req.params.id, req.user.id]
    );
    const booking = rows[0];
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.status !== "confirmed")
      return res.status(400).json({ error: "This booking is no longer active" });

    await pool.query(
      "UPDATE bookings SET late_flag=1, late_eta_minutes=$1, late_marked_at=now() WHERE id=$2",
      [etaMinutes, req.params.id]
    );

    broadcast(booking.session_id, {
      type: "patient_late",
      sessionId: booking.session_id,
      tokenNumber: booking.token_number,
      patientName: booking.patient_name,
      etaMinutes,
    });

    res.json({ success: true, etaMinutes });
  } catch (err) {
    console.error("[bookings mark-late]", err.message);
    res.status(500).json({ error: err.message });
  }
});

'''

patch(
    os.path.join(BACKEND_SRC, "routes/bookings.js"),
    [
        (
            "close_reason, created_at",
            "close_reason, late_flag, late_eta_minutes, created_at",
            4,
        ),
        (
            "b.close_reason, b.created_at",
            "b.close_reason, b.late_flag, b.late_eta_minutes, b.created_at",
            1,
        ),
        (
            "    closeReason: r.close_reason || null,\n    createdAt: r.created_at,",
            "    closeReason: r.close_reason || null,\n"
            "    lateFlag: r.late_flag === 1,\n"
            "    lateEtaMinutes: r.late_eta_minutes ?? null,\n"
            "    createdAt: r.created_at,",
            1,
        ),
        (
            "module.exports = router;",
            NEW_ROUTE + "module.exports = router;",
            1,
        ),
    ],
    "bookings.js",
)

# ── 3. Frontend: types.ts — Booking shape ───────────────────────────────────
patch(
    "src/types.ts",
    [(
        "  closeReason?: string | null;\n}",
        "  closeReason?: string | null;\n"
        "  lateFlag?: boolean;\n"
        "  lateEtaMinutes?: number | null;\n}",
        1,
    )],
    "types.ts",
)

# ── 4. Frontend: api.ts — client call ───────────────────────────────────────
patch(
    "src/api.ts",
    [(
        '  updateStatus: (id: string, status: string)  => patch<Booking>(`/bookings/${id}/status`, { status }),',
        '  updateStatus: (id: string, status: string)  => patch<Booking>(`/bookings/${id}/status`, { status }),\n'
        '  markLate:   (id: string, etaMinutes: number) => post<{ success: boolean; etaMinutes: number }>(`/bookings/${id}/mark-late`, { etaMinutes }),',
        1,
    )],
    "api.ts",
)

# ── 5. Frontend: TokenTrackerPage.tsx — button + handler ───────────────────
LATE_UI = '''
      {/* ── Running Late ── */}
      {!isPastSession && (myStatus === "red" || myStatus === "yellow") && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
          {booking.lateFlag ? (
            <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              <Clock className="w-4 h-4 mt-0.5 shrink-0" />
              <span>You've let the doctor know you're running about {booking.lateEtaMinutes} min late.</span>
            </div>
          ) : showLateOptions ? (
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-2">How late will you be?</p>
              <div className="flex flex-wrap gap-2">
                {[10, 15, 20, 30, 45].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    disabled={markingLate}
                    onClick={() => handleMarkLate(mins)}
                    className="px-3 py-1.5 rounded-full border border-amber-300 text-amber-700 text-sm font-medium hover:bg-amber-50 disabled:opacity-50"
                  >
                    ~{mins} min
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowLateOptions(false)}
                  className="px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowLateOptions(true)}
              className="flex items-center gap-2 text-sm font-semibold text-amber-700 border border-amber-300 rounded-xl px-4 py-2.5 hover:bg-amber-50"
            >
              <Clock className="w-4 h-4" /> Running late? Let the doctor know
            </button>
          )}
        </div>
      )}

      {/* ── Queue Board ── */}'''

patch(
    "src/pages/patient/TokenTrackerPage.tsx",
    [
        (
            'import { useStore } from "../../context/StoreContext";',
            'import { useStore } from "../../context/StoreContext";\n'
            'import { bookings as bookingsApi } from "../../api";',
            1,
        ),
        (
            '  const [bannerDismissed, setBannerDismissed] = useState(false);',
            '  const [bannerDismissed, setBannerDismissed] = useState(false);\n'
            '  // "Running late?" ETA picker\n'
            '  const [showLateOptions, setShowLateOptions] = useState(false);\n'
            '  const [markingLate, setMarkingLate] = useState(false);',
            1,
        ),
        (
            "  const msg = getStatusMsg();",
            "  async function handleMarkLate(etaMinutes: number) {\n"
            "    if (!booking) return;\n"
            "    setMarkingLate(true);\n"
            "    try {\n"
            "      await bookingsApi.markLate(booking.id, etaMinutes);\n"
            "      setShowLateOptions(false);\n"
            "      refreshFromStorage();\n"
            "    } catch (err) {\n"
            "      console.error(err);\n"
            "      alert(\"Couldn't send your update. Please try again.\");\n"
            "    } finally {\n"
            "      setMarkingLate(false);\n"
            "    }\n"
            "  }\n\n"
            "  const msg = getStatusMsg();",
            1,
        ),
        (
            "      {/* ── Queue Board ── */}",
            LATE_UI,
            1,
        ),
    ],
    "TokenTrackerPage.tsx",
)

# ── 6. Frontend: DoctorDashboard.tsx — badge on the doctor's live list ─────
patch(
    "src/pages/doctor/DoctorDashboard.tsx",
    [(
        '                          {b.status === "unvisited" && (\n'
        '                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">\n'
        '                              <XCircle className="w-3 h-3" /> Unvisited\n'
        '                            </span>\n'
        '                          )}',
        '                          {b.status === "unvisited" && (\n'
        '                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">\n'
        '                              <XCircle className="w-3 h-3" /> Unvisited\n'
        '                            </span>\n'
        '                          )}\n'
        '                          {b.lateFlag && b.status === "confirmed" && (\n'
        '                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">\n'
        '                              ⏰ Running ~{b.lateEtaMinutes} min late\n'
        '                            </span>\n'
        '                          )}',
        1,
    )],
    "DoctorDashboard.tsx",
)

print("\\nAll patches applied successfully.")
