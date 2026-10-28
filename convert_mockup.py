"""
Converts the Stitch mockup (code.html) into an exact-copy React component.

Usage (PowerShell, from F:\\O-frontend):
    python convert_mockup.py F:\\stitch\\code.html src\\mobile\\MobileDesign.tsx
"""
import json
import re
import sys
from pathlib import Path

src_path = Path(sys.argv[1])
out_path = Path(sys.argv[2])

html = src_path.read_text(encoding="utf-8")

# 1. Keep only the visible body markup (header, main, aside, nav)
body = re.search(r"<body[^>]*>(.*)</body>", html, re.S).group(1)
body = re.sub(r"<script.*?</script>", "", body, flags=re.S)

# 2. Remove HTML comments
body = re.sub(r"<!--.*?-->", "", body, flags=re.S)

# 3. style="a: b; c: d" -> style={{ a: "b", c: "d" }}
def style_to_obj(m):
    raw = m.group(1).replace("&quot;", '"').replace("&#39;", "'")
    items = []
    for p in raw.split(";"):
        if not p.strip():
            continue
        k, v = p.split(":", 1)
        camel = re.sub(r"-([a-z])", lambda x: x.group(1).upper(), k.strip())
        items.append(f"{camel}: {json.dumps(v.strip())}")
    return "style={{ " + ", ".join(items) + " }}"

body = re.sub(r'style="([^"]*)"', style_to_obj, body)

# 4. HTML -> JSX attributes
body = re.sub(r"\bclass=", "className=", body)
body = body.replace("stroke-linecap=", "strokeLinecap=")
body = body.replace("stroke-width=", "strokeWidth=")
body = body.replace("stroke-dasharray=", "strokeDasharray=")
body = body.replace("fill-rule=", "fillRule=")

# 5. Self-close void tags
def self_close(m):
    tag = m.group(0)
    return tag if tag.endswith("/>") else tag[:-1] + " />"

body = re.sub(r"<(img|input|br|hr)\b[^>]*>", self_close, body)

# 6. Tidy whitespace
body = re.sub(r"\n\s*\n+", "\n", body).strip()

tsx = f'''// Auto-generated from the Stitch mockup. Exact visual copy, static sample data.
// Real data gets wired in later steps. Do not hand-edit before step 4.
export default function MobileDesign() {{
  return (
    <>
{body}
    </>
  );
}}
'''

out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text(tsx, encoding="utf-8")
print(f"Wrote {out_path} ({len(tsx.splitlines())} lines)")
