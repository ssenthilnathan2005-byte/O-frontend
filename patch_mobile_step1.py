"""
Step 1 patch for the exact mobile design.
Run from F:\\O-frontend with convert_mockup.py in the same folder:
    python patch_mobile_step1.py F:\\stitch\\code.html
Safe to run twice (each edit checks if it is already applied).
"""
import subprocess
import sys
from pathlib import Path

mockup = sys.argv[1] if len(sys.argv) > 1 else r"F:\stitch\code.html"
root = Path.cwd()


def read(p):
    return Path(p).read_text(encoding="utf-8")


def write(p, s):
    Path(p).write_text(s, encoding="utf-8", newline="\n")


# 1. tailwind.config.js: mono font + the mockup's three shadows
p = root / "tailwind.config.js"
s = read(p)
if "JetBrains Mono" not in s:
    old = 'sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],'
    assert old in s, "fontFamily.sans line not found in tailwind.config.js"
    s = s.replace(old, old + '\n        mono: ["JetBrains Mono", "monospace"],')
if "ticket:" not in s:
    old = 'xs: "0 1px 2px 0 oklch(0.22 0.03 240 / 0.05)",'
    assert old in s, "boxShadow.xs line not found in tailwind.config.js"
    add = (
        "\n        clinical: \"0 1px 3px rgba(15, 23, 42, 0.04), 0 4px 14px -2px rgba(15, 23, 42, 0.05)\","
        "\n        ticket: \"0 4px 20px -3px rgba(15, 118, 110, 0.08)\","
        "\n        float: \"0 10px 25px -4px rgba(15, 118, 110, 0.35)\","
    )
    s = s.replace(old, old + add)
write(p, s)
print("tailwind.config.js ok")

# 2. src/index.css: helpers, scoped so nothing else on the site changes
p = root / "src" / "index.css"
s = read(p)
if "mobile-design" not in s:
    s += '''

/* ===== Mobile design (scoped to .mobile-design) ===== */
@layer base {
  .mobile-design *,
  .mobile-design ::before,
  .mobile-design ::after {
    border-color: #e5e7eb;
  }
}

@layer utilities {
  .mobile-design .no-scrollbar::-webkit-scrollbar { display: none; }
  .mobile-design .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  .mobile-design .safe-top { padding-top: env(safe-area-inset-top, 16px); }
  .mobile-design .safe-bottom { padding-bottom: env(safe-area-inset-bottom, 20px); }
  .mobile-design .ticket-dashed-line {
    background-image: linear-gradient(to right, #cbd5e1 50%, rgba(255,255,255,0) 0%);
    background-position: bottom;
    background-size: 8px 1.5px;
    background-repeat: repeat-x;
  }
}
'''
    write(p, s)
print("src/index.css ok")

# 3. index.html: fonts + Font Awesome icons
p = root / "index.html"
s = read(p)
if "font-awesome" not in s:
    links = '''    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
'''
    assert "</head>" in s, "</head> not found in index.html"
    s = s.replace("</head>", links + "  </head>", 1)
    write(p, s)
print("index.html ok")

# 4. Generate the exact-copy component
out = root / "src" / "mobile" / "MobileDesign.tsx"
subprocess.run(
    [sys.executable, "convert_mockup.py", mockup, str(out)],
    check=True,
)

# 5. Preview page (wrapper replaces the mockup's <body> classes)
page = root / "src" / "mobile" / "MobilePreviewPage.tsx"
if not page.exists():
    write(
        page,
        '''import MobileDesign from "./MobileDesign";

export default function MobilePreviewPage() {
  return (
    <div className="mobile-design min-h-screen bg-slate-50 pb-28 text-slate-800 antialiased font-sans">
      <MobileDesign />
    </div>
  );
}
''',
    )
print("src/mobile/MobilePreviewPage.tsx ok")
print("Done. Next: add the /mobile-preview route (step 2).")
