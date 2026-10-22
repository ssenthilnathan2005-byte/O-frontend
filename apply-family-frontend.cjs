const fs = require("fs"), path = require("path");
const root = process.cwd();
const load = p => { const raw = fs.readFileSync(path.join(root, p), "utf8"); return { crlf: raw.includes("\r\n"), s: raw.replace(/\r\n/g, "\n") }; };
const save = (p, o) => fs.writeFileSync(path.join(root, p), o.crlf ? o.s.replace(/\n/g, "\r\n") : o.s, "utf8");
const rep = (o, re, fn, label) => { if (!re.test(o.s)) throw new Error("anchor not found: " + label); o.s = o.s.replace(re, fn); };

// ---- api.ts
const api = load("src/api.ts");
if (!api.s.includes("familyMembers")) {
  const block = [
    "",
    "// Family members (sub-profiles under one phone-number account)",
    "export interface FamilyMember { id: string; relation: string; name: string; yearOfBirth: string; age: string; gender: string; bloodGroup: string; }",
    "export interface FamilyMemberInput { relation: string; name: string; yearOfBirth: string; gender?: string; bloodGroup?: string; }",
    "export const familyMembers = {",
    "  list:   () => get<FamilyMember[]>(\"/family-members\"),",
    "  add:    (data: FamilyMemberInput) => post<FamilyMember>(\"/family-members\", data),",
    "  update: (id: string, data: FamilyMemberInput) => patch<FamilyMember>(`/family-members/${id}`, data),",
    "  remove: (id: string) => del<{ success: boolean }>(`/family-members/${id}`),",
    "};",
    ""
  ].join("\n");
  rep(api, /(patch<\{ success: boolean \}>\("\/patients\/language", \{ preferredLanguage \}\),\s*\};)/, m => m + "\n" + block, "api patients block");
}

// ---- BookingDialog.tsx
const bd = load("src/components/booking/BookingDialog.tsx");
if (!bd.s.includes("familyMembers")) {
  rep(bd, /import \{ bookings as bookingsApi, payments, patients \} from "\.\.\/\.\.\/api";/,
    () => 'import { bookings as bookingsApi, payments, patients, familyMembers } from "../../api";', "api import");
  rep(bd, /import type \{ Doctor, Hospital \} from "\.\.\/\.\.\/api";/,
    () => 'import type { Doctor, Hospital, FamilyMember } from "../../api";', "type import");
  rep(bd, /(const \[profileLoading, setProfileLoading\] = useState\(false\);)/,
    m => m + "\n  const [family, setFamily] = useState<FamilyMember[]>([]);", "profileLoading state");
  rep(bd, /(\.finally\(\(\) => setProfileLoading\(false\)\);\s*\}, \[open\]\);)/,
    m => m + "\n\n  // Fetch family member pills whenever the dialog opens\n  useEffect(() => {\n    if (!open) return;\n    familyMembers.list().then(setFamily).catch(() => setFamily([]));\n  }, [open]);", "profile effect");
  const pills = [
    "{family.filter(m => m.relation !== \"Self\").length > 0 && (",
    "                <div>",
    "                  <p className=\"text-xs font-medium text-gray-500 mb-2\">Family members</p>",
    "                  <div className=\"flex flex-wrap gap-2\">",
    "                    {family.filter(m => m.relation !== \"Self\").map(m => (",
    "                      <button",
    "                        key={m.id}",
    "                        type=\"button\"",
    "                        onClick={() => {",
    "                          setPatientName(m.name);",
    "                          setPatientPhone(profile?.phone || \"\");",
    "                          setPatientAge(m.age);",
    "                          setPatientYob(m.yearOfBirth || \"\");",
    "                          setBookingFor(\"other\");",
    "                          goToStep(\"complaint\");",
    "                        }}",
    "                        className=\"px-3 py-1.5 rounded-full border border-teal-200 bg-teal-50 text-teal-700 text-sm font-medium hover:bg-teal-100 transition-colors\"",
    "                      >",
    "                        {m.relation} - {m.name}",
    "                      </button>",
    "                    ))}",
    "                  </div>",
    "                </div>",
    "              )}",
    "              "
  ].join("\n");
  rep(bd, /(<div className="space-y-3">\s*)(<button\s+type="button"\s+disabled=\{profileLoading\})/,
    (m, a, b) => a + pills + b, "for-whom buttons");
  rep(bd, /async function handleFreeBook\(\) \{\n/, m => m + "    if (paying) return;\n", "handleFreeBook");
  if (/async function handlePay\(\)[^{\n]*\{\n/.test(bd.s)) {
    bd.s = bd.s.replace(/async function handlePay\(\)[^{\n]*\{\n/, m => m + "    if (paying) return;\n");
  } else { console.log("note: handlePay start not matched, skipped double-tap guard there"); }
}

// ---- ProfilePage.tsx
const pp = load("src/pages/patient/ProfilePage.tsx");
if (!pp.s.includes("FamilyMembersSection")) {
  rep(pp, /import LanguageSwitcher from "@\/components\/LanguageSwitcher";/,
    m => m + '\nimport FamilyMembersSection from "@/components/FamilyMembersSection";', "LanguageSwitcher import");
  rep(pp, /(\n[ \t]*)\{\/\* Language \*\/\}/, (m, ws) => ws + "<FamilyMembersSection />" + ws + "{/* Language */}", "Language marker");
}

save("src/api.ts", api); save("src/components/booking/BookingDialog.tsx", bd); save("src/pages/patient/ProfilePage.tsx", pp);
console.log("frontend patched OK");