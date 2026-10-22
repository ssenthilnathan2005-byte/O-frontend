"""Adds an About Us page + footer link. Run from the O-frontend repo root: python add_about.py"""
import os, sys

def edit(path, old, new, count=1):
    s = open(path, encoding="utf-8").read()
    if s.count(old) != count:
        sys.exit(f"ABORT {path}: expected {count} match(es), found {s.count(old)} for: {old[:60]!r}")
    open(path, "w", encoding="utf-8", newline="").write(s.replace(old, new))
    print("patched", path)

PAGE = r'''import { ArrowLeft, Clock, ShieldCheck, Building2, Activity, Users, Target, Eye, ChevronRight } from "lucide-react";
import { useRouter } from "../router/RouterContext";
import logo from "../assets/doctorbooked-logo-cropped.png";

// To add a co-founder, copy an object below and fill in the details.
const founders = [
  {
    name: "Senthilnathan",
    role: "Founder",
    bio: "Leads product and engineering at Doctor Booked, building practical technology that helps independent clinics and small hospitals run smoother and serve patients faster.",
  },
];

const values = [
  { icon: Clock, title: "Respect for time", text: "Every minute in a waiting room is a minute a patient could spend recovering, working or with family. We build to give that time back." },
  { icon: ShieldCheck, title: "Trust and privacy", text: "Health information is personal. We design for security and transparency so patients and hospitals can rely on us." },
  { icon: Building2, title: "Built for every clinic", text: "From a single-doctor clinic to a multi-speciality hospital, our tools are simple enough to adopt and strong enough to scale." },
  { icon: Activity, title: "Real-time by design", text: "Live token tracking and instant updates keep patients, doctors and front desks in sync throughout the day." },
];

const offerings = [
  "Online token booking and live queue tracking for patients",
  "Doctor, front-desk and hospital admin dashboards",
  "Digital prescriptions and patient records",
  "Hospital management tools for IPD, labs, billing and staff",
];

export default function AboutUsPage() {
  const { goBack, navigate } = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button type="button" onClick={goBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <span className="text-gray-300">|</span>
          <span className="text-sm font-semibold text-gray-800">About Doctor Booked</span>
        </div>
      </header>

      {/* Hero */}
      <section style={{ background: "linear-gradient(180deg,#ecfdf9 0%,#f9fafb 100%)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 lg:py-20 text-center">
          <img src={logo} alt="Doctor Booked" style={{ width: 200, display: "block", margin: "0 auto" }} />
          <span className="mt-8 inline-block rounded-full bg-teal-50 border border-teal-100 px-4 py-1 text-xs font-semibold tracking-wide text-teal-700 uppercase">
            About us
          </span>
          <h1 className="mt-4 text-3xl lg:text-5xl font-bold text-gray-900 leading-tight">
            Making healthcare <span className="text-teal-600">simpler</span> for patients and hospitals
          </h1>
          <p className="mt-4 text-base lg:text-lg text-gray-500 max-w-2xl mx-auto">
            Doctor Booked is a healthcare booking and real-time queue management platform built for independent clinics and small hospitals.
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 lg:py-14 space-y-12">
        {/* Our story */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:p-10">
          <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Our story</h2>
          <div className="mt-4 space-y-4 text-gray-600 leading-relaxed">
            <p>
              Long waits and uncertainty are a daily reality in many clinics. Patients arrive early, sit for hours and never know when their turn will come, while hospital staff manage the crowd with paper registers and phone calls.
            </p>
            <p>
              Doctor Booked was started to change that. Our platform lets patients book a token, follow their position in the queue live and walk in only when it is their turn. For hospitals, it replaces manual coordination with a clear, real-time view of the day.
            </p>
            <p>
              We began with independent clinics and small hospitals, the places that often lack access to modern software, and we continue to grow alongside the hospitals that trust us.
            </p>
          </div>
        </section>

        {/* Mission / Vision */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:p-8">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center mb-4"><Target className="w-5 h-5 text-teal-600" /></div>
            <h3 className="text-lg font-semibold text-gray-900">Our mission</h3>
            <p className="mt-2 text-gray-600 leading-relaxed">
              To eliminate the waiting room by giving every patient a transparent, real-time view of their care, and every hospital the tools to run efficiently.
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:p-8">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center mb-4"><Eye className="w-5 h-5 text-teal-600" /></div>
            <h3 className="text-lg font-semibold text-gray-900">Our vision</h3>
            <p className="mt-2 text-gray-600 leading-relaxed">
              To become the digital backbone for clinics and hospitals across India, making quality, well-organised healthcare accessible to everyone.
            </p>
          </div>
        </section>

        {/* What we do */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:p-10">
          <h2 className="text-xl lg:text-2xl font-bold text-gray-900">What we do</h2>
          <ul className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            {offerings.map((o) => (
              <li key={o} className="flex items-start gap-3 rounded-xl bg-gray-50 border border-gray-100 p-4 text-sm text-gray-700">
                <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold">&#10003;</span>
                {o}
              </li>
            ))}
          </ul>
        </section>

        {/* Values */}
        <section>
          <h2 className="text-xl lg:text-2xl font-bold text-gray-900">What we stand for</h2>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {values.map((v) => (
              <div key={v.title} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center mb-3"><v.icon className="w-5 h-5 text-teal-600" /></div>
                <h3 className="font-semibold text-gray-900">{v.title}</h3>
                <p className="mt-1 text-sm text-gray-500 leading-relaxed">{v.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Founders */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:p-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center"><Users className="w-5 h-5 text-teal-600" /></div>
            <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Meet the founders</h2>
          </div>
          <p className="mt-4 text-gray-600 leading-relaxed">
            Doctor Booked was founded by a team of three engineers, all B.E. Mechanical Engineering graduates of Mepco Schlenk Engineering College, Sivakasi. Trained to solve real-world problems with a systems mindset, we apply the same discipline to the everyday challenges of healthcare operations.
          </p>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {founders.map((f) => (
              <div key={f.name} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-white flex items-center justify-center text-xl font-bold">
                  {f.name.charAt(0)}
                </div>
                <h3 className="mt-3 font-semibold text-gray-900">{f.name}</h3>
                <p className="text-xs font-medium text-teal-700 uppercase tracking-wide">{f.role}</p>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{f.bio}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-2xl bg-teal-600 text-white p-8 lg:p-12 text-center">
          <h2 className="text-xl lg:text-2xl font-bold">Skip the waiting room</h2>
          <p className="mt-2 text-teal-50 max-w-xl mx-auto">Find a hospital near you and book your token in minutes, or bring your clinic onto Doctor Booked.</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => navigate({ path: "/patient/hospitals" })}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white text-teal-700 font-semibold px-6 py-3 hover:bg-teal-50 transition-colors"
            >
              Find Hospitals <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate({ path: "/hospital-admin/login" })}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/60 text-white font-semibold px-6 py-3 hover:bg-white/10 transition-colors"
            >
              Hospital Admin Login
            </button>
          </div>
        </section>

        <p className="text-center text-xs text-gray-400">2026 Doctor Booked. All rights reserved.</p>
      </div>
    </div>
  );
}
'''

if not os.path.isdir("src"):
    sys.exit("Run this from the O-frontend repo root")

if os.path.exists("src/pages/AboutUsPage.tsx"):
    print("AboutUsPage.tsx already exists, skipping create")
else:
    open("src/pages/AboutUsPage.tsx", "w", encoding="utf-8", newline="").write(PAGE)
    print("created src/pages/AboutUsPage.tsx")

R = "src/router/RouterContext.tsx"
edit(R, '  | { path: "/privacy" }\n', '  | { path: "/privacy" }\n  | { path: "/about" }\n')
edit(R, '  if (pathname === "/privacy") return { path: "/privacy" };\n',
        '  if (pathname === "/privacy") return { path: "/privacy" };\n  if (pathname === "/about") return { path: "/about" };\n')

A = "src/App.tsx"
edit(A, 'import PrivacyPage from "./pages/PrivacyPage";\n',
        'import PrivacyPage from "./pages/PrivacyPage";\nimport AboutUsPage from "./pages/AboutUsPage";\n')
edit(A, '  function renderPage() {\n    if (!user) {\n',
        '  function renderPage() {\n    if (route.path === "/about") return <AboutUsPage />;\n    if (!user) {\n')
edit(A, '  const hideTopNav =\n    isAdmin ||\n', '  const hideTopNav =\n    isAdmin ||\n    route.path === "/about" ||\n')
edit(A, 'const publicPaths = ["/terms", "/privacy", "/delete-account"];',
        'const publicPaths = ["/terms", "/privacy", "/delete-account", "/about"];')
edit(A, '<p className="text-gray-400 text-sm">Skip the waiting room. Track your token live.</p></div>',
        '<p className="text-gray-400 text-sm">Skip the waiting room. Track your token live.</p><button onClick={() => navigate({ path: "/about" })} className="mt-3 text-sm font-medium text-gray-600 hover:text-teal-600 transition-colors">About Us</button></div>')
print("done")
