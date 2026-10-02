const fs = require("fs");
const p = "src/components/ui/select.tsx";
let s = fs.readFileSync(p, "utf8");
let changed = 0;

// 1. fixed height limit set inline (does not depend on Tailwind class syntax)
if (!s.includes("data-scrollfix")) {
  const target = "        position={position}\n        {...props}";
  const target2 = "        position={position}\r\n        {...props}";
  const add = '        data-scrollfix="1"\n        style={{ maxHeight: "min(320px, var(--radix-select-content-available-height))", ...(props as any).style }}\n';
  if (s.includes(target)) { s = s.replace(target, add + target); changed++; }
  else if (s.includes(target2)) { s = s.replace(target2, add.replace(/\n/g, "\r\n") + target2); changed++; }
  else throw new Error("Content props block not found");
}

// 2. remove the fixed viewport height that blocks scrolling
const vh = 'h-[var(--radix-select-trigger-height)] ';
if (s.includes(vh)) { s = s.replace(vh, ""); changed++; }

// 3. old Tailwind v4-only classes -> v3 safe
s = s.replace("max-h-(--radix-select-content-available-height)", "touch-pan-y overscroll-contain");
s = s.replace("origin-(--radix-select-content-transform-origin)", "origin-[var(--radix-select-content-transform-origin)]");

fs.writeFileSync(p, s, "utf8");
console.log("done, " + changed + " change(s) applied");
