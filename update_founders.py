"""Updates the founders section on the About Us page. Run from the O-frontend repo root."""
import re, sys

P = "src/pages/AboutUsPage.tsx"
s = open(P, encoding="utf-8").read()

new_founders = '''const founders = [
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
];'''

s, n1 = re.subn(r"const founders = \[.*?\n\];", lambda m: new_founders, s, count=1, flags=re.S)

s, n2 = re.subn(
    r"Doctor Booked was founded by a team of three engineers.*?healthcare operations\.",
    "Doctor Booked is led by a four-member founding team that brings together business, technology, marketing and operations, working closely with hospitals to build technology that fits how they actually run.",
    s, count=1, flags=re.S)

s, n3 = re.subn(r"Meet the founders", "Meet our leadership team", s, count=1)
s, n4 = re.subn(r"sm:grid-cols-2 lg:grid-cols-3 gap-4\">\s*\{founders", 'sm:grid-cols-2 lg:grid-cols-4 gap-4">\n            {founders', s, count=1)
s, n5 = re.subn(r'text-xs font-medium text-teal-700 uppercase tracking-wide">\{f\.role\}', 'text-xs font-medium text-teal-700 tracking-wide">{f.role}', s, count=1)

if (n1, n2, n3, n4, n5) != (1, 1, 1, 1, 1):
    sys.exit(f"ABORT, nothing written. Match counts: {(n1, n2, n3, n4, n5)}")

open(P, "w", encoding="utf-8", newline="").write(s)
print("updated", P)
