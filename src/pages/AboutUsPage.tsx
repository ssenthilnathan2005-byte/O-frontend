import { ArrowLeft, Clock, ShieldCheck, Building2, Activity, Users, Target, Eye, ChevronRight } from "lucide-react";
import { useRouter } from "../router/RouterContext";
import { useState } from "react";
import { Send, CheckCircle2 } from "lucide-react";
import { enquiries } from "../api";
import logo from "../assets/doctorbooked-logo-cropped.png";

// To add a co-founder, copy an object below and fill in the details.
const founders = [
  {
    name: "Senthil Nathan",
    role: "Chief Executive Officer (CEO)",
    bio: "Leads the company's vision, business strategy, product direction, partnerships and overall growth.",
  },
  {
    name: "Kishore",
    role: "Chief Technology Officer (CTO)",
    bio: "Leads technology strategy, software development, hospital ERP architecture and AI integration.",
  },
  {
    name: "Bala Kumaran",
    role: "Chief Marketing Officer (CMO)",
    bio: "Leads marketing, branding, customer acquisition, hospital outreach and market expansion.",
  },
  {
    name: "Logesh",
    role: "Chief Operating Officer (COO)",
    bio: "Oversees daily operations, team coordination, implementation and hospital onboarding.",
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

function SectionHeading({ label, title, text, center }: { label: string; title: string; text?: string; center?: boolean }) {
  return (
    <div className={center ? "text-center max-w-2xl mx-auto" : ""}>
      <span className="text-xs font-semibold tracking-wide text-teal-700 uppercase">{label}</span>
      <h2 className="mt-2 text-2xl lg:text-3xl font-bold text-gray-900">{title}</h2>
      {text && <p className="mt-3 text-gray-500 leading-relaxed">{text}</p>}
    </div>
  );
}

const CARD = "bg-white rounded-2xl shadow-sm border border-gray-100";

export default function AboutUsPage() {
  const { goBack, navigate } = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 py-4 sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-14 flex items-center gap-3">
          <button type="button" onClick={goBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <span className="text-gray-300">|</span>
          <span className="text-sm font-semibold text-gray-800">About Doctor Booked</span>
        </div>
      </header>

      {/* Hero */}
      <section style={{ background: "linear-gradient(180deg,#ecfdf9 0%,#f9fafb 100%)" }}>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-14 py-10 lg:py-14 flex flex-col items-center text-center">
          <img src={logo} alt="Doctor Booked" className="w-36 lg:w-44 h-auto" />
          <span className="mt-5 inline-block rounded-full bg-teal-50 border border-teal-100 px-4 py-1 text-xs font-semibold tracking-wide text-teal-700 uppercase">
            About us
          </span>
          <h1 className="mt-4 text-3xl sm:text-4xl 2xl:text-5xl font-bold text-gray-900 leading-tight xl:whitespace-nowrap">
            Making healthcare <span className="text-teal-600">simpler</span> for patients and hospitals
          </h1>
          <p className="mt-4 text-base lg:text-lg text-gray-500 leading-relaxed max-w-4xl 2xl:max-w-none 2xl:whitespace-nowrap">
            Doctor Booked is a healthcare booking and real-time queue management platform built for independent clinics and small hospitals.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => navigate({ path: "/patient/hospitals" })}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-teal-600 hover:bg-teal-700 text-white font-semibold px-6 py-3 shadow-lg shadow-teal-600/25 transition-colors"
            >
              Find Hospitals <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-teal-200 bg-white text-teal-700 font-semibold px-6 py-3 hover:bg-teal-50 transition-colors"
            >
              Contact us
            </button>
          </div>

          <div className={`${CARD} mt-10 w-full max-w-6xl p-6 lg:p-8 text-left`}>
            <h2 className="text-lg lg:text-xl font-bold text-gray-900 text-center">What we do</h2>
            <ul className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              {offerings.map((o) => (
                <li key={o} className="flex items-center gap-3 rounded-xl bg-gray-50 border border-gray-100 p-4 text-sm text-gray-700">
                  <span className="w-5 h-5 shrink-0 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold">&#10003;</span>
                  {o}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-14 py-10 lg:py-14 space-y-12 lg:space-y-16">
        {/* Our story */}
        <section className="space-y-8">
          <SectionHeading label="Our story" title="Why Doctor Booked exists" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-gray-600 leading-relaxed">
            <p className={`${CARD} p-6 border-t-4 border-t-teal-500`}>
              Long waits and uncertainty are a daily reality in many clinics. Patients arrive early, sit for hours and never know when their turn will come, while hospital staff manage the crowd with paper registers and phone calls.
            </p>
            <p className={`${CARD} p-6 border-t-4 border-t-teal-500`}>
              Doctor Booked was started to change that. Our platform lets patients book a token, follow their position in the queue live and walk in only when it is their turn. For hospitals, it replaces manual coordination with a clear, real-time view of the day.
            </p>
            <p className={`${CARD} p-6 border-t-4 border-t-teal-500`}>
              We began with independent clinics and small hospitals, the places that often lack access to modern software, and we continue to grow alongside the hospitals that trust us.
            </p>
          </div>
        </section>

        {/* Mission / Vision */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={`${CARD} p-6 lg:p-8`}>
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center mb-4"><Target className="w-5 h-5 text-teal-600" /></div>
            <h3 className="text-lg font-semibold text-gray-900">Our mission</h3>
            <p className="mt-2 text-gray-600 leading-relaxed">
              To eliminate the waiting room by giving every patient a transparent, real-time view of their care, and every hospital the tools to run efficiently.
            </p>
          </div>
          <div className={`${CARD} p-6 lg:p-8`}>
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center mb-4"><Eye className="w-5 h-5 text-teal-600" /></div>
            <h3 className="text-lg font-semibold text-gray-900">Our vision</h3>
            <p className="mt-2 text-gray-600 leading-relaxed">
              To become the digital backbone for clinics and hospitals across India, making quality, well-organised healthcare accessible to everyone.
            </p>
          </div>
        </section>

        {/* Values */}
        <section>
          <SectionHeading label="Our values" title="What we stand for" />
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v) => (
              <div key={v.title} className={`${CARD} p-6`}>
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center mb-4"><v.icon className="w-5 h-5 text-teal-600" /></div>
                <h3 className="font-semibold text-gray-900">{v.title}</h3>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">{v.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Founders */}
        <section>
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex w-12 h-12 shrink-0 rounded-xl bg-teal-50 items-center justify-center"><Users className="w-6 h-6 text-teal-600" /></div>
            <div className="max-w-3xl">
              <SectionHeading
                label="Leadership"
                title="Meet our leadership team"
                text="Doctor Booked is led by a four-member founding team that brings together business, technology, marketing and operations, working closely with hospitals to build technology that fits how they actually run."
              />
            </div>
          </div>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {founders.map((f) => (
              <div key={f.name} className={`${CARD} p-6`}>
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-white flex items-center justify-center text-xl font-bold">
                  {f.name.charAt(0)}
                </div>
                <h3 className="mt-4 font-semibold text-gray-900">{f.name}</h3>
                <p className="text-xs font-medium text-teal-700 tracking-wide">{f.role}</p>
                <p className="mt-3 text-sm text-gray-600 leading-relaxed">{f.bio}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact / register your hospital */}
        <section id="contact" className="space-y-8 scroll-mt-24">
          <div>
            <SectionHeading
              center label="Get in touch"
              title="Register your hospital or contact us"
              text="Want to bring your clinic or hospital onto Doctor Booked, or have a question? Share your details and our founders will get back to you on the phone number you share."
            />
          </div>
          <div className={`${CARD} p-6 lg:p-8 max-w-4xl mx-auto`}>
            <EnquiryForm />
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

        <p className="text-center text-xs text-gray-400">&copy; 2026 Doctor Booked. All rights reserved.</p>
      </main>
    </div>
  );
}

const SIZE_OPTIONS = ["Single-doctor clinic", "Clinic (2 to 5 doctors)", "Hospital up to 30 beds", "Hospital 30 to 100 beds", "Hospital 100+ beds"];
const FIELD = "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-base sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500";

function EnquiryForm() {
  const [f, setF] = useState({
    hospitalName: "", contactName: "", designation: "", phone: "",
    email: "", city: "", hospitalSize: "", message: "", website: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof f) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!f.hospitalName.trim()) return setErr("Please enter your hospital name.");
    if (!f.contactName.trim()) return setErr("Please enter your name.");
    if (f.phone.replace(/\D/g, "").length < 10) return setErr("Please enter a valid phone number.");
    setBusy(true);
    try {
      await enquiries.submit({
        hospitalName: f.hospitalName, contactName: f.contactName, designation: f.designation,
        phone: f.phone, email: f.email, city: f.city, hospitalSize: f.hospitalSize,
        message: f.message, website: f.website,
      });
      setDone(true);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not send your enquiry. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 rounded-2xl bg-teal-50 border border-teal-100 p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-teal-600 mx-auto" />
        <h3 className="mt-3 text-lg font-semibold text-gray-900">Thank you, we have received your details</h3>
        <p className="mt-1 text-sm text-gray-600">Our team will contact you on the phone number you shared.</p>
        <button
          type="button"
          onClick={() => { setDone(false); setF({ hospitalName: "", contactName: "", designation: "", phone: "", email: "", city: "", hospitalSize: "", message: "", website: "" }); }}
          className="mt-5 text-sm font-medium text-teal-700 hover:underline"
        >
          Send another enquiry
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Hospital / clinic name *</label>
        <input className={FIELD} value={f.hospitalName} onChange={set("hospitalName")} maxLength={150} placeholder="e.g. Sri Raja Hospital" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Your name *</label>
        <input className={FIELD} value={f.contactName} onChange={set("contactName")} maxLength={100} placeholder="Full name" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Your role</label>
        <input className={FIELD} value={f.designation} onChange={set("designation")} maxLength={80} placeholder="Owner, doctor, administrator..." />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Phone number *</label>
        <input className={FIELD} type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} maxLength={30} placeholder="10-digit mobile number" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
        <input className={FIELD} type="email" value={f.email} onChange={set("email")} maxLength={150} placeholder="Optional" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">City / town</label>
        <input className={FIELD} value={f.city} onChange={set("city")} maxLength={80} placeholder="e.g. Virudhunagar" />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-gray-600 mb-1">Hospital size</label>
        <select className={FIELD} value={f.hospitalSize} onChange={set("hospitalSize")}>
          <option value="">Select (optional)</option>
          {SIZE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-gray-600 mb-1">How can we help?</label>
        <textarea className={FIELD} rows={4} value={f.message} onChange={set("message")} maxLength={1500} placeholder="Tell us what you need, for example token booking, hospital management, labs or billing." />
      </div>

      {/* Honeypot: hidden from people, bots fill it in */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
        value={f.website} onChange={set("website")}
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />

      {err && <div className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{err}</div>}
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold px-8 py-3 shadow-lg shadow-teal-600/25 transition-colors w-full sm:w-auto"
        >
          <Send className="w-4 h-4" /> {busy ? "Sending..." : "Send enquiry"}
        </button>
      </div>
    </form>
  );
}
