import { useMemo } from "react";
import { UserCog, Users2, CalendarCheck, Building2, Activity, Clock } from "lucide-react";
import { useStore } from "../../context/StoreContext";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function HADashboard() {
  const { doctors, bookings, user } = useStore();

  const hospitalId = user?.role === "hospital_admin" ? user.hospitalId : "";
  const hospitalName = user?.role === "hospital_admin" ? user.hospitalName : "Hospital";

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

  const todayCompleted = todayBookings.filter((b) => b.status === "completed").length;
  const todayConfirmed = todayBookings.filter((b) => b.status === "confirmed").length;
  const todayUnvisited = todayBookings.filter((b) => b.status === "unvisited").length;

  const availableDoctors = myDoctors.filter((d) => d.isAvailable).length;

  const stats = [
    {
      label: "Total Doctors",
      value: myDoctors.length,
      sub: `${availableDoctors} available today`,
      icon: UserCog,
      color: "text-teal-600",
      bg: "bg-teal-50",
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
      label: "Total Patients",
      value: myBookings.length,
      sub: "last 7 days",
      icon: Users2,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  const now = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

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
        {stats.map(({ label, value, sub, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
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
              const completed = docBookings.filter((b) => b.status === "completed").length;
              const confirmed = docBookings.filter((b) => b.status === "confirmed").length;
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

      {/* System Info */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-teal-500" />
          System Info
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Platform</span>
            <span className="font-medium text-gray-800">DoctorBooked v1.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Data Store</span>
            <span className="font-medium text-gray-800">PostgreSQL (Supabase)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Last Refreshed</span>
            <span className="font-medium text-teal-600 flex items-center gap-1">
              <Clock className="w-3 h-3" />{now}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
