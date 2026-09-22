import { useMemo } from "react";
import { UserCog, Users2, CalendarCheck, Pill, Activity, BedDouble, FlaskConical, Package, Wrench } from "lucide-react";
import { useState, useEffect } from "react";
import { useStore } from "../../context/StoreContext";
import { isLiveBookingStatus, normalizeBookingStatus } from "../../lib/bookingStatus";
import { useRouter } from "../../router/RouterContext";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function HADashboard() {
  const { doctors, bookings, user } = useStore();
  const { navigate } = useRouter();

  const hospitalId = user?.role === "hospital_admin" ? user.hospitalId : "";
  const hospitalName = user?.role === "hospital_admin" ? user.hospitalName : "Hospital";

  const [pharmacyCount, setPharmacyCount] = useState(0);
  const [hasPharmacy, setHasPharmacy] = useState(false);
  const [bedStats, setBedStats] = useState({ occupied: 0, total: 0, maintenance: 0 });
  const [pendingLabOrders, setPendingLabOrders] = useState(0);
  const [activeInward, setActiveInward] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);

  const BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000/api";

  useEffect(() => {
    if (!hospitalId) return;
    async function fetchPharmacy() {
      try {
        const { getToken } = await import("../../api");
        const res = await fetch(`${BASE}/pharmacy/staff?hospitalId=${hospitalId}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const data = await res.json();
        setPharmacyCount(Array.isArray(data) ? data.filter((s: any) => s.is_active).length : 0);
        setHasPharmacy(Array.isArray(data) && data.length > 0);
      } catch { }
    }
    fetchPharmacy();

    async function fetchOpsStats() {
      try {
        const { getToken } = await import("../../api");
        const headers = { Authorization: `Bearer ${getToken()}` };

        const [wardsRes, labRes, inwardRes, invRes] = await Promise.all([
          fetch(`${BASE}/wards?hospitalId=${hospitalId}`, { headers }).then(r => r.json()).catch(() => []),
          fetch(`${BASE}/hospital-lab/orders?hospitalId=${hospitalId}`, { headers }).then(r => r.json()).catch(() => []),
          fetch(`${BASE}/inward?hospitalId=${hospitalId}`, { headers }).then(r => r.json()).catch(() => []),
          fetch(`${BASE}/inventory?hospitalId=${hospitalId}`, { headers }).then(r => r.json()).catch(() => []),
        ]);

        if (Array.isArray(wardsRes)) {
          const totals = wardsRes.reduce((acc: any, w: any) => ({
            occupied: acc.occupied + Number(w.occupied_beds || 0),
            total: acc.total + Number(w.total_beds_actual ?? w.total_beds ?? 0),
            maintenance: acc.maintenance + Number(w.maintenance_beds || 0),
          }), { occupied: 0, total: 0, maintenance: 0 });
          setBedStats(totals);
        }

        if (Array.isArray(labRes)) {
          setPendingLabOrders(labRes.filter((o: any) => ["ordered","sample_collected","processing"].includes(o.status)).length);
        }

        if (Array.isArray(inwardRes)) {
          setActiveInward(inwardRes.filter((p: any) => p.status === "admitted").length);
        }

        if (Array.isArray(invRes)) {
          setLowStockCount(invRes.filter((i: any) => Number(i.quantity) <= Number(i.min_quantity)).length);
        }
      } catch { }
    }
    fetchOpsStats();
  }, [hospitalId]);

  const myDoctors = useMemo(
    () => doctors.filter((d) => d.hospitalId === hospitalId),
    [doctors, hospitalId]
  );

  const myBookings = useMemo(
    () => bookings.filter((b) => myDoctors.some((d) => d.id === b.doctorId)),
    [bookings, myDoctors]
  );

  const todayBookings = useMemo(
    () => myBookings.filter((b) => b.date === todayStr()),
    [myBookings]
  );

  const todayCompleted = todayBookings.filter((b) => normalizeBookingStatus(b.status) === "completed").length;
  const todayConfirmed = todayBookings.filter((b) => isLiveBookingStatus(b.status)).length;
  const todayUnvisited = todayBookings.filter((b) => normalizeBookingStatus(b.status) === "unvisited").length;

  const availableDoctors = myDoctors.filter((d) => d.isAvailable).length;

  const stats = [
    {
      label: "Total Doctors",
      value: myDoctors.length,
      sub: `${availableDoctors} available today`,
      icon: UserCog,
      color: "text-teal-600",
      bg: "bg-teal-50",
      to: "/hospital-admin/doctors",
    },
    {
      label: "Today's Bookings",
      value: todayBookings.length,
      sub: `${todayConfirmed} confirmed`,
      icon: CalendarCheck,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Completed Today",
      value: todayCompleted,
      sub: `${todayUnvisited} unvisited`,
      icon: Activity,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Pharmacy Staff",
      value: pharmacyCount,
      sub: hasPharmacy ? "pharmacy active" : "no pharmacy",
      icon: Pill,
      color: "text-orange-600",
      bg: "bg-orange-50",
      to: "/hospital-admin/pharmacy",
    },
    {
      label: "Bed Occupancy",
      value: `${bedStats.occupied}/${bedStats.total}`,
      sub: bedStats.maintenance > 0 ? `${bedStats.maintenance} cleaning` : "beds occupied",
      icon: BedDouble,
      color: "text-red-600",
      bg: "bg-red-50",
      to: "/hospital-admin/wards",
    },
    {
      label: "Admitted Patients",
      value: activeInward,
      sub: "currently inward",
      icon: Users2,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      to: "/hospital-admin/ipd",
    },
    {
      label: "Pending Lab Orders",
      value: pendingLabOrders,
      sub: "awaiting results",
      icon: FlaskConical,
      color: "text-purple-600",
      bg: "bg-purple-50",
      to: "/hospital-admin/lab",
    },
    {
      label: "Low Stock Items",
      value: lowStockCount,
      sub: lowStockCount > 0 ? "needs reordering" : "all stocked",
      icon: Package,
      color: lowStockCount > 0 ? "text-amber-600" : "text-gray-500",
      bg: lowStockCount > 0 ? "bg-amber-50" : "bg-gray-50",
      to: "/hospital-admin/inventory",
    },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {hospitalName} &mdash; system stats at a glance
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(({ label, value, sub, icon: Icon, color, bg, to }) => (
          <div key={label}
            onClick={to ? () => navigate({ path: to } as Parameters<typeof navigate>[0]) : undefined}
            className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3 transition-all ${to ? "cursor-pointer hover:shadow-md hover:border-teal-200" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{label}</span>
              <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
            </div>
            <div>
              <span className="text-3xl font-bold text-gray-900">{value}</span>
              <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Doctor Status Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <UserCog className="w-4 h-4 text-teal-500" />
            Doctor Status — Today
          </h2>
        </div>
        <div className="divide-y divide-gray-50">
          {myDoctors.length === 0 ? (
            <p className="text-sm text-gray-400 px-5 py-6 text-center">No doctors added yet.</p>
          ) : (
            myDoctors.map((doc) => {
              const docBookings = todayBookings.filter((b) => b.doctorId === doc.id);
              const completed = docBookings.filter((b) => normalizeBookingStatus(b.status) === "completed").length;
              const confirmed = docBookings.filter((b) => isLiveBookingStatus(b.status)).length;
              return (
                <div key={doc.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{doc.name}</p>
                    <p className="text-xs text-gray-400">{doc.specialty}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-green-600 font-medium">{completed} done</span>
                    <span className="text-blue-500">{confirmed} waiting</span>
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${doc.isAvailable ? "bg-teal-50 text-teal-600" : "bg-gray-100 text-gray-400"}`}>
                      {doc.isAvailable ? "Available" : "Unavailable"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>


    </div>
  );
}
