// Auto-generated from the Stitch mockup. Exact visual copy, static sample data.
// Real data gets wired in later steps. Do not hand-edit before step 4.
export default function MobileDesign() {
  return (
    <>
<header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 safe-top" data-purpose="app-header">
<div className="px-4 py-2.5 flex items-center justify-between">
<div className="flex items-center gap-2.5" data-purpose="brand-logo">
<div className="w-8 h-8 rounded-lg bg-teal-800 text-white flex items-center justify-center shadow-sm">
<i className="fa-solid fa-notes-medical text-base"></i>
</div>
<div>
<div className="flex items-center gap-1.5">
<span className="text-base font-bold tracking-tight text-slate-900 leading-none">Doctor<span className="text-teal-700">Booked</span></span>
<span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-teal-50 text-teal-800 border border-teal-200/60 leading-none">EHR Core</span>
</div>
<span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">Clinical Outpatient Network</span>
</div>
</div>
<div className="flex items-center gap-2">
<button aria-label="Change Language" className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md bg-slate-100 text-slate-700 border border-slate-200/70 hover:bg-slate-200 transition-colors" type="button">
<i className="fa-solid fa-globe text-slate-400 text-[10px]"></i>
<span className="">EN</span>
<i className="fa-solid fa-chevron-down text-[8px] text-slate-400"></i>
</button>
<button aria-label="Clinical Alerts" className="relative w-8 h-8 rounded-lg bg-slate-100 text-slate-600 border border-slate-200/70 flex items-center justify-center hover:bg-slate-200 transition-colors" type="button">
<i className="fa-regular fa-bell text-xs"></i>
<span className="absolute 1.5 top-1.5 right-1.5 w-2 h-2 bg-rose-600 rounded-full ring-2 ring-white"></span>
</button>
<div className="flex items-center pl-0.5" data-purpose="user-avatar-pill">
<div className="w-8 h-8 rounded-lg bg-teal-900 text-teal-100 font-bold text-xs flex items-center justify-center border border-teal-700 ring-1 ring-slate-200">
            SP
          </div>
</div>
</div>
</div>
<div className="px-4 py-1.5 bg-slate-100/80 border-t border-slate-200/60 flex items-center justify-between text-xs">
<div className="flex items-center gap-1.5 min-w-0">
<i className="fa-solid fa-location-crosshairs text-teal-700 text-[11px]"></i>
<span className="text-slate-500 font-medium text-[11px]">Region:</span>
<span className="font-bold text-slate-800 text-[11px] truncate">Chennai Central • Apollo / Devaki Zone</span>
</div>
<button className="text-teal-700 hover:text-teal-900 font-bold text-[11px] flex items-center gap-0.5 flex-shrink-0" type="button">
<span className="">Change</span>
<i className="fa-solid fa-chevron-right text-[8px]"></i>
</button>
</div>
</header>
<main className="px-4 space-y-4 pt-3.5 max-w-lg mx-auto">
<section className="flex items-end justify-between" data-purpose="greeting-section">
<div>
<div className="flex items-center gap-1.5">
<span className="inline-block w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200"></span>
<span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">Patient Portal • Active Session</span>
</div>
<h1 className="text-2xl text-slate-900 tracking-tight mt-0.5 font-normal" style={{ fontFamily: "Newsreader, serif", letterSpacing: "-0.02em", fontFeatureSettings: "\"liga\", \"clig\"" }}>Good afternoon, <span className="italic font-medium text-teal-900" style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "1.15em" }}>Senthil</span></h1>
<p className="text-xs text-slate-500 font-normal">MRN: <span className="font-mono text-slate-700 font-semibold">#CHE-94821</span> • Last consult: 14 Feb 2025</p>
</div>
<a className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-colors" href="#emergency">
<i className="fa-solid fa-truck-medical text-[11px] text-rose-600"></i>
<span className="">24/7 ER</span>
</a>
</section>
<section className="space-y-2" data-purpose="search-container">
<div className="relative flex items-center">
<div className="absolute left-3.5 text-slate-400 pointer-events-none">
<i className="fa-solid fa-magnifying-glass text-xs"></i>
</div>
<input className="w-full pl-9 pr-24 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 font-medium shadow-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 outline-none transition-all" placeholder="Search hospitals, specialties, doctors, tests..." type="text" />
<div className="absolute right-2 flex items-center gap-1">
<button aria-label="Clear Search" className="text-[11px] text-slate-400 hover:text-slate-600 font-medium px-1.5 py-1" type="button">
            Clear
          </button>
<button aria-label="Filter Options" className="h-7 px-2 rounded-lg bg-slate-100 border border-slate-200/80 flex items-center gap-1 text-slate-700 hover:bg-slate-200 text-xs font-medium" type="button">
<i className="fa-solid fa-sliders text-[10px] text-slate-500"></i>
<span className="text-[10px]">Filter</span>
</button>
</div>
</div>
<div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs" data-purpose="sector-filters">
<button className="flex-shrink-0 px-2.5 py-1 rounded-md text-[11px] font-bold bg-teal-900 text-white shadow-sm border border-teal-900" type="button">
          All Facilities
        </button>
<button className="flex-shrink-0 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50" type="button">
<i className="fa-solid fa-award text-amber-500 text-[10px] mr-1"></i>NABH Accredited
        </button>
<button className="flex-shrink-0 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50" type="button">
<i className="fa-solid fa-heart-pulse text-teal-600 text-[10px] mr-1"></i>Cardiology OPD
        </button>
<button className="flex-shrink-0 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50" type="button">
<i className="fa-solid fa-shield-halved text-emerald-600 text-[10px] mr-1"></i>Govt Verified
        </button>
<button className="flex-shrink-0 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50" type="button">
<i className="fa-solid fa-flask text-sky-600 text-[10px] mr-1"></i>Diagnostic Labs
        </button>
<button className="flex-shrink-0 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50" type="button">
          24/7 Super Speciality
        </button>
</div>
</section>
<section data-purpose="hero-appointment-banner">
<div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 text-white p-4 shadow-clinical border border-teal-800/80">
<div className="absolute right-0 top-0 w-36 h-36 bg-[radial-gradient(#2dd4bf_1px,transparent_1px)] [background-size:12px_12px] opacity-15 pointer-events-none"></div>
<div className="relative z-10 flex flex-col justify-between h-full gap-3">
<div className="flex items-start justify-between">
<div className="flex items-center gap-2">
<div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-teal-200">
<i className="fa-solid fa-calendar-check text-sm"></i>
</div>
<div>
<span className="block text-xs font-bold text-white uppercase tracking-wider">OPD Outpatient Portal</span>
<span className="text-[10px] text-teal-200/90 font-medium">NABH &amp; JCI Verified Hospitals</span>
</div>
</div>
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
<span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              LIVE TOKENS ACTIVE
            </span>
</div>
<div>
<h2 className="text-2xl font-normal text-white tracking-tight leading-tight" style={{ fontFamily: "Newsreader, serif", letterSpacing: "-0.025em", fontFeatureSettings: "\"liga\", \"clig\"" }}>OPD Token &amp; <span className="italic font-normal text-teal-200/95" style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "1.12em" }}>Consultation Booking</span></h2>
<p className="text-xs text-slate-200 font-normal mt-1 leading-relaxed">Direct hospital queue token integration. Zero physical OPD wait-time with real-time consultation tracking.</p>
</div>
<div className="pt-1 flex items-center justify-between border-t border-white/10">
<button className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white text-slate-900 rounded-lg text-xs font-bold shadow-sm hover:bg-slate-100 active:scale-95 transition-all" type="button">
<span className="">Book OPD Token</span>
<i className="fa-solid fa-arrow-right text-[10px] text-teal-800"></i>
</button>
<div className="flex items-center gap-2 text-[10px] font-mono text-teal-200/90">
<span className="flex items-center gap-1"><i className="fa-solid fa-circle-check text-emerald-400 text-[9px]"></i> 142 Hospitals</span>
<span className="text-white/30">•</span>
<span className="">98.6% On-Time</span>
</div>
</div>
</div>
</div>
</section>
<section className="bg-white rounded-2xl border border-slate-200/90 shadow-ticket overflow-hidden" data-purpose="queue-tracker-card">
<div className="bg-slate-900 text-white px-3.5 py-2 flex items-center justify-between text-xs">
<div className="flex items-center gap-2">
<i className="fa-solid fa-qrcode text-teal-400 text-sm"></i>
<div>
<span className="font-mono text-[10px] text-slate-300 uppercase tracking-widest block leading-none">Electronic Patient Token</span>
<span className="font-bold text-xs text-white">OPD-CARDIO-ROOM 4B</span>
</div>
</div>
<div className="flex items-center gap-2">
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            IN PROGRESS
          </span>
<button className="text-[11px] font-bold text-teal-300 hover:text-white flex items-center gap-1 ml-1" type="button">
<span className="">Ticket</span>
<i className="fa-solid fa-chevron-right text-[9px]"></i>
</button>
</div>
</div>
<div className="p-3.5 space-y-3">
<div className="flex items-start justify-between gap-3">
<div className="space-y-1">
<div className="flex items-center gap-2">
<span className="px-2 py-0.5 rounded bg-teal-900 text-white font-mono font-bold text-xs">Token #A-24</span>
<span className="text-[11px] text-slate-500 font-mono font-medium">Dep: Cardiology / Adult OPD</span>
</div>
<h3 className="text-base font-semibold text-slate-900 leading-snug" style={{ fontFamily: "Newsreader, Georgia, serif", fontSize: "17px", letterSpacing: "-0.015em" }}>Devaki Multi Speciality Hospital</h3>
<p className="text-xs text-slate-600 flex items-center gap-1.5"><i className="fa-solid fa-user-doctor text-teal-700 text-xs"></i><span className="font-medium text-slate-800" style={{ fontFamily: "'Newsreader', serif", fontSize: "14px", letterSpacing: "-0.01em" }}>Dr. K. Ramanathan,</span> <span className="text-[11px] font-sans text-slate-500 font-semibold tracking-wide uppercase font-mono">MD, DM (Cardio)</span></p>
</div>
<div className="text-right flex-shrink-0 bg-slate-50 p-2 rounded-lg border border-slate-200">
<span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Est. Consult</span>
<span className="text-sm font-bold text-teal-800 font-mono block">02:45 PM</span>
<span className="text-[10px] font-medium text-emerald-600">~ 18 mins wait</span>
</div>
</div>
<div className="ticket-dashed-line w-full h-[1px]"></div>
<div className="grid grid-cols-3 gap-2 text-center text-xs">
<div className="bg-slate-50 rounded-lg p-1.5 border border-slate-150">
<span className="text-[10px] text-slate-400 block font-mono">QUEUE POS</span>
<span className="font-bold text-slate-800 font-mono text-xs">3 of 7 Waiting</span>
</div>
<div className="bg-slate-50 rounded-lg p-1.5 border border-slate-150">
<span className="text-[10px] text-slate-400 block font-mono">CURRENT CALL</span>
<span className="font-bold text-teal-700 font-mono text-xs">#A-21 Inside</span>
</div>
<div className="bg-slate-50 rounded-lg p-1.5 border border-slate-150">
<span className="text-[10px] text-slate-400 block font-mono">CONSULT ROOM</span>
<span className="font-bold text-slate-800 font-mono text-xs">Desk 04 • 1st Flr</span>
</div>
</div>
</div>
</section>
<section data-purpose="services-directory">
<div className="flex items-center justify-between mb-2">
<h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">Clinical Services Directory</h3>
<span className="text-[11px] text-teal-700 font-semibold cursor-pointer hover:underline">Accredited Network</span>
</div>
<div className="grid grid-cols-3 gap-2">
<a className="bg-white rounded-xl p-3 border border-slate-200 hover:border-teal-700/60 shadow-sm flex flex-col items-center text-center transition-all group" href="#hospitals">
<div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-800 border border-teal-100 flex items-center justify-center mb-1.5 group-hover:bg-teal-800 group-hover:text-white transition-colors">
<i className="fa-solid fa-hospital text-sm"></i>
</div>
<span className="text-xs font-bold text-slate-900 leading-tight">Hospitals</span>
<span className="text-[10px] text-slate-400 mt-0.5">NABH &amp; General</span>
</a>
<a className="bg-white rounded-xl p-3 border border-slate-200 hover:border-teal-700/60 shadow-sm flex flex-col items-center text-center transition-all group" href="#labs">
<div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-800 border border-teal-100 flex items-center justify-center mb-1.5 group-hover:bg-teal-800 group-hover:text-white transition-colors">
<i className="fa-solid fa-vial-circle-check text-sm"></i>
</div>
<span className="text-xs font-bold text-slate-900 leading-tight">Diagnostic Labs</span>
<span className="text-[10px] text-slate-400 mt-0.5">NABL Certified</span>
</a>
<a className="bg-white rounded-xl p-3 border border-slate-200 hover:border-teal-700/60 shadow-sm flex flex-col items-center text-center transition-all group" href="#bookings">
<div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-800 border border-teal-100 flex items-center justify-center mb-1.5 group-hover:bg-teal-800 group-hover:text-white transition-colors">
<i className="fa-solid fa-ticket-simple text-sm"></i>
</div>
<span className="text-xs font-bold text-slate-900 leading-tight">OPD Tokens</span>
<span className="text-[10px] text-slate-400 mt-0.5">Live Queue Pass</span>
</a>
<a className="bg-white rounded-xl p-3 border border-slate-200 hover:border-teal-700/60 shadow-sm flex flex-col items-center text-center transition-all group" href="#records">
<div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-800 border border-teal-100 flex items-center justify-center mb-1.5 group-hover:bg-teal-800 group-hover:text-white transition-colors">
<i className="fa-solid fa-folder-medical text-sm"></i>
</div>
<span className="text-xs font-bold text-slate-900 leading-tight">EHR Records</span>
<span className="text-[10px] text-slate-400 mt-0.5">Discharge &amp; Labs</span>
</a>
<a className="bg-white rounded-xl p-3 border border-slate-200 hover:border-teal-700/60 shadow-sm flex flex-col items-center text-center transition-all group" href="#prescriptions">
<div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-800 border border-teal-100 flex items-center justify-center mb-1.5 group-hover:bg-teal-800 group-hover:text-white transition-colors">
<i className="fa-solid fa-file-prescription text-sm"></i>
</div>
<span className="text-xs font-bold text-slate-900 leading-tight">E-Prescription</span>
<span className="text-[10px] text-slate-400 mt-0.5">9 Verified Rx</span>
</a>
<a className="bg-white rounded-xl p-3 border border-rose-200 hover:border-rose-300 shadow-sm flex flex-col items-center text-center transition-all group" href="#emergency">
<div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center mb-1.5 group-hover:bg-rose-700 group-hover:text-white transition-colors">
<i className="fa-solid fa-truck-medical text-sm"></i>
</div>
<span className="text-xs font-bold text-rose-700 leading-tight">Emergency SOS</span>
<span className="text-[10px] text-rose-500 font-semibold mt-0.5">Dispatched in 8m</span>
</a>
</div>
</section>
<section className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm" data-purpose="map-snippet">
<div className="relative h-24 bg-slate-100 overflow-hidden">
<div className="absolute inset-0 opacity-70 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:12px_12px] flex items-center justify-center">
<svg className="w-full h-full text-slate-300" preserveAspectRatio="none" viewBox="0 0 400 100">
<path d="M0,30 Q120,10 200,50 T400,20" fill="none" stroke="#94a3b8" strokeLinecap="round" strokeWidth="2.5"></path>
<path d="M60,95 L180,15 L320,85" fill="none" stroke="#cbd5e1" strokeWidth="2"></path>
<path d="M210,0 L210,100" fill="none" stroke="#e2e8f0" strokeDasharray="3" strokeWidth="2"></path>
</svg>
</div>
<div className="absolute top-2.5 left-3 bg-white/95 backdrop-blur-sm px-2.5 py-0.5 rounded-md shadow-xs border border-slate-200 flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
<span className="w-2 h-2 rounded-full bg-teal-600"></span>
<span className="">12 Clinical Centers within 5.0 km</span>
</div>
<button className="absolute bottom-2 right-2.5 bg-slate-900 text-white px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 hover:bg-slate-800 transition-colors" type="button">
<i className="fa-solid fa-map-location-dot text-[10px] text-teal-400"></i>
<span className="">View Triage Map</span>
</button>
<div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2">
<div className="w-6 h-6 rounded-md bg-teal-800 text-white flex items-center justify-center shadow-md border border-white text-[10px]">
<i className="fa-solid fa-h"></i>
</div>
</div>
<div className="absolute top-1/3 left-2/3 -translate-x-1/2 -translate-y-1/2">
<div className="w-6 h-6 rounded-md bg-teal-700 text-white flex items-center justify-center shadow-md border border-white text-[10px]">
<i className="fa-solid fa-plus text-[9px]"></i>
</div>
</div>
</div>
</section>
<section className="space-y-2.5" data-purpose="hospitals-near-you">
<div className="flex items-center justify-between">
<div>
<h2 className="text-base font-semibold text-slate-900 tracking-tight leading-snug" style={{ fontFamily: "Newsreader, serif", fontSize: "17px", letterSpacing: "-0.015em" }}>Hospitals &amp; Clinical Centers</h2>
<p className="text-xs text-slate-500 font-medium">Verified OPD queues • Direct token admission</p>
</div>
<a className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-900" href="#all-hospitals">
<span className="">View All (18)</span>
<i className="fa-solid fa-chevron-right text-[9px]"></i>
</a>
</div>
<div className="space-y-2.5">
<article className="bg-white rounded-xl p-3 border border-slate-200 hover:border-teal-700/60 shadow-sm transition-all" data-purpose="hospital-item-card">
<div className="flex gap-3">
<div className="w-16 h-16 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden relative border border-slate-200">
<img alt="Demo Hospital" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCY1Y9933-gEcnorZv1H_1DlNSwqOYGTd0tqrPGKmGmncLQVTATbM15Yfp_ACsIchluVQSgZW_cZ-IuuScs-FvrDbN3jCGB680oE21s-tlCxEpGb4eyCLKnkDFAGdEgZnAb4z1UbDaKj1xpi7WHFawC9poteuP-KRBfSXF8anI2pGE1EiaIFSshleEEUVC57wsAOWFji1T7uQve6zXYTtCoWgCcJIgr_nOJ0L720pufQ_SOMvVHaqMedA" />
<span className="absolute top-1 left-1 px-1 py-0.2 rounded bg-slate-900 text-[8px] font-mono font-bold text-emerald-400 uppercase">
                OPD OPEN
              </span>
</div>
<div className="flex-1 min-w-0">
<div className="flex items-start justify-between gap-1">
<div>
<div className="flex items-center gap-1.5 flex-wrap">
<h4 className="text-[13px] font-semibold text-slate-900 truncate" style={{ fontFamily: "Newsreader, serif" }}>Demo Hospital &amp; Research Centre</h4>
<span className="px-1.5 py-0.2 rounded text-[9px] font-bold font-mono bg-teal-50 text-teal-800 border border-teal-200">NABH</span>
</div>
<p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
<i className="fa-solid fa-location-dot text-slate-400 text-[9px]"></i>
<span className="truncate">Madurai Main Rd • 1.2 km</span>
</p>
</div>
<div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded font-bold text-[10px] border border-slate-200 flex-shrink-0">
<i className="fa-solid fa-star text-[9px] text-amber-500"></i>
<span className="">4.6</span>
</div>
</div>
<div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
<div className="flex items-center gap-2 text-[11px]">
<span className="font-mono text-slate-600">
<strong className="text-teal-800 font-bold">5</strong> in queue
                  </span>
<span className="text-slate-300">•</span>
<span className="text-[10px] text-teal-800 font-semibold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200/50">Next: 15m</span>
</div>
<button className="px-2.5 py-1 bg-teal-800 hover:bg-teal-900 text-white rounded text-[11px] font-bold shadow-xs active:scale-95 transition-all" type="button">
                  Book OPD
                </button>
</div>
</div>
</div>
</article>
<article className="bg-white rounded-xl p-3 border border-slate-200 hover:border-teal-700/60 shadow-sm transition-all" data-purpose="hospital-item-card">
<div className="flex gap-3">
<div className="w-16 h-16 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden relative border border-slate-200">
<img alt="Devaki Multi Speciality Hospital" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB7Kym1qI1ELdez19FePRWxX6a_yfirIS04FVt-RPhuz7jVmcDnGMaG0cH__ZHjcyjPGtZaOMDZlQK-1yLNGg6AoiYcVQLVdj1UbFQritqYCBJbMv4qFuVUOJDiVbEZR_ykHINtccu1WjnVxV8o07RrHQJDRzFGsZ6ZztZAXiNzst2igy4xAgj7nRK0Mrb5iPTf8Udw2mKPwLaO7U0Xu5M4o_zSRdkGstWA6gYJ0iI_CgHlR6LrN_8Bng" />
<span className="absolute top-1 left-1 px-1 py-0.2 rounded bg-slate-900 text-[8px] font-mono font-bold text-emerald-400 uppercase">
                OPD OPEN
              </span>
</div>
<div className="flex-1 min-w-0">
<div className="flex items-start justify-between gap-1">
<div>
<div className="flex items-center gap-1.5 flex-wrap">
<h4 className="text-[13px] font-semibold text-slate-900 truncate" style={{ fontFamily: "Newsreader, serif" }}>Devaki Multi Speciality Hospital</h4>
<span className="px-1.5 py-0.2 rounded text-[9px] font-bold font-mono bg-amber-50 text-amber-800 border border-amber-200">JCI CERT</span>
</div>
<p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
<i className="fa-solid fa-location-dot text-slate-400 text-[9px]"></i>
<span className="truncate">KK Nagar, Madurai • 2.5 km</span>
</p>
</div>
<div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded font-bold text-[10px] border border-slate-200 flex-shrink-0">
<i className="fa-solid fa-star text-[9px] text-amber-500"></i>
<span className="">4.8</span>
</div>
</div>
<div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
<div className="flex items-center gap-2 text-[11px]">
<span className="font-mono text-slate-600">
<strong className="text-teal-800 font-bold">12</strong> in queue
                  </span>
<span className="text-slate-300">•</span>
<span className="text-[10px] text-teal-800 font-semibold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200/50">Cardio / Ortho</span>
</div>
<button className="px-2.5 py-1 bg-teal-800 hover:bg-teal-900 text-white rounded text-[11px] font-bold shadow-xs active:scale-95 transition-all" type="button">
                  Book OPD
                </button>
</div>
</div>
</div>
</article>
<article className="bg-white rounded-xl p-3 border border-slate-200 hover:border-teal-700/60 shadow-sm transition-all" data-purpose="hospital-item-card">
<div className="flex gap-3">
<div className="w-16 h-16 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden relative border border-slate-200">
<img alt="GRN MULTI SPECIALITY" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAIqqcFdgcQGkq4YQOISbQ9KhwOKKk0SxGzmZ3CmpASmMMchCCt5zjNfZm7fNdy0wA4c_EALTOYF5Gfj-AyAthHluOEojVLm2WAlZGFYqDeK_Ql08XmzPLjETBMIb95YtTrnZ2DOyFgZhDRdPm15HAHVszE21liQjiucyDriRBBNu-hD-XIDwbA1qmK0TjSwZif23a7U_iHPSy6Xnpgxaxzkju6BbzHNOWezRBOqrsVtix2Igc1zK-oew" />
<span className="absolute top-1 left-1 px-1 py-0.2 rounded bg-slate-900 text-[8px] font-mono font-bold text-emerald-400 uppercase">
                OPD OPEN
              </span>
</div>
<div className="flex-1 min-w-0">
<div className="flex items-start justify-between gap-1">
<div>
<div className="flex items-center gap-1.5 flex-wrap">
<h4 className="text-[13px] font-semibold text-slate-900 truncate" style={{ fontFamily: "Newsreader, serif" }}>GRN Multi Speciality</h4>
<span className="px-1.5 py-0.2 rounded text-[9px] font-bold font-mono bg-blue-50 text-blue-800 border border-blue-200">24/7 CASUALTY</span>
</div>
<p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
<i className="fa-solid fa-location-dot text-slate-400 text-[9px]"></i>
<span className="truncate">Gandhipuram • 4.1 km</span>
</p>
</div>
<div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded font-bold text-[10px] border border-slate-200 flex-shrink-0">
<i className="fa-solid fa-star text-[9px] text-amber-500"></i>
<span className="">4.5</span>
</div>
</div>
<div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
<div className="flex items-center gap-2 text-[11px]">
<span className="font-mono text-slate-600">
<strong className="text-teal-800 font-bold">2</strong> in queue
                  </span>
<span className="text-slate-300">•</span>
<span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/50">Immediate Entry</span>
</div>
<button className="px-2.5 py-1 bg-teal-800 hover:bg-teal-900 text-white rounded text-[11px] font-bold shadow-xs active:scale-95 transition-all" type="button">
                  Book OPD
                </button>
</div>
</div>
</div>
</article>
<article className="bg-white rounded-xl p-3 border border-slate-200 hover:border-teal-700/60 shadow-sm transition-all" data-purpose="hospital-item-card">
<div className="flex gap-3">
<div className="w-16 h-16 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden relative border border-slate-200">
<img alt="Kinder Hospital" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAsG6rx-RG26HhM58iZd6spNUtgnPBWmL8lo5mPDNa4MXwBSi_9SIIAj02OKGedtcKdZKni_hN4EKXj-b9SarG77JsxCmm-tFxwimOWY_D8LRRi07C2wTW4giLX9t5dgjywbAd4gVmyIOcl0HPuViZm_y7MZr5xtL93kZuvmQBNj1xBO8Sk5KnSVuU7bPErExktgeTptI1iD7Pctx8qJStdz1h0jppdURtP6bJERSRJzI8kCXnDDTimig" />
<span className="absolute top-1 left-1 px-1 py-0.2 rounded bg-slate-900 text-[8px] font-mono font-bold text-emerald-400 uppercase">
                OPD OPEN
              </span>
</div>
<div className="flex-1 min-w-0">
<div className="flex items-start justify-between gap-1">
<div>
<div className="flex items-center gap-1.5 flex-wrap">
<h4 className="text-[13px] font-semibold text-slate-900 truncate" style={{ fontFamily: "Newsreader, serif" }}>Kinder Super Speciality</h4>
<span className="px-1.5 py-0.2 rounded text-[9px] font-bold font-mono bg-purple-50 text-purple-800 border border-purple-200">PAEDIATRIC</span>
</div>
<p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
<i className="fa-solid fa-location-dot text-slate-400 text-[9px]"></i>
<span className="truncate">Paediatric &amp; Maternity Care • 3.2 km</span>
</p>
</div>
<div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded font-bold text-[10px] border border-slate-200 flex-shrink-0">
<i className="fa-solid fa-star text-[9px] text-amber-500"></i>
<span className="">4.9</span>
</div>
</div>
<div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
<div className="flex items-center gap-2 text-[11px]">
<span className="font-mono text-slate-600">
<strong className="text-teal-800 font-bold">8</strong> in queue
                  </span>
<span className="text-slate-300">•</span>
<span className="text-[10px] text-purple-700 font-semibold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/50">Child OPD</span>
</div>
<button className="px-2.5 py-1 bg-teal-800 hover:bg-teal-900 text-white rounded text-[11px] font-bold shadow-xs active:scale-95 transition-all" type="button">
                  Book OPD
                </button>
</div>
</div>
</div>
</article>
</div>
</section>
</main>
<aside className="fixed bottom-20 right-4 z-40" data-purpose="floating-support-action">
<button aria-label="Clinical Desk Support" className="w-12 h-12 rounded-xl bg-teal-900 hover:bg-teal-950 text-white shadow-float flex items-center justify-center transition-transform active:scale-90 relative border border-teal-700" type="button">
<i className="fa-solid fa-headset text-lg"></i>
<span className="absolute -top-1 -right-1 flex h-3 w-3">
<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
<span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-white"></span>
</span>
</button>
</aside>
<nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 safe-bottom" data-purpose="bottom-navigation-bar">
<div className="max-w-md mx-auto grid grid-cols-5 px-1 py-1.5">
<a className="flex flex-col items-center justify-center py-1 text-teal-800 transition-colors" href="#home">
<i className="fa-solid fa-house-chimney-medical text-base"></i>
<span className="text-[10px] font-bold mt-1">Dashboard</span>
</a>
<a className="flex flex-col items-center justify-center py-1 text-slate-500 hover:text-slate-800 transition-colors" href="#hospitals">
<i className="fa-solid fa-hospital-user text-base"></i>
<span className="text-[10px] font-medium mt-1">Hospitals</span>
</a>
<a className="flex flex-col items-center justify-center py-1 text-slate-500 hover:text-slate-800 transition-colors" href="#bookings">
<div className="relative">
<i className="fa-solid fa-ticket-simple text-base"></i>
<span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-teal-700"></span>
</div>
<span className="text-[10px] font-medium mt-1">Tokens</span>
</a>
<a className="flex flex-col items-center justify-center py-1 text-slate-500 hover:text-slate-800 transition-colors" href="#records">
<i className="fa-regular fa-folder-open text-base"></i>
<span className="text-[10px] font-medium mt-1">Records</span>
</a>
<a className="flex flex-col items-center justify-center py-1 text-slate-500 hover:text-slate-800 transition-colors" href="#profile">
<i className="fa-regular fa-circle-user text-base"></i>
<span className="text-[10px] font-medium mt-1">Account</span>
</a>
</div>
</nav>
    </>
  );
}
