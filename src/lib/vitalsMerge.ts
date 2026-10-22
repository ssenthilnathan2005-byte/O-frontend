// vitalsMerge.ts - one scan for every monitor: label + unit + layout passes, merged.
export type Word = { text: string; x0: number; y0: number; x1: number; y1: number; conf?: number };
export type Field = 'sys' | 'dia' | 'pulse' | 'spo2' | 'rr' | 'temp';
export type Status = 'read' | 'suggested' | 'conflict' | 'empty';
export type Result = { value: number | null; status: Status; candidates: { value: number; source: string }[] };

const RANGE: Record<Field, [number, number]> = {
  sys: [50, 280], dia: [20, 180], pulse: [20, 250], spo2: [50, 100], rr: [4, 80], temp: [30, 43],
};
const LABELS: Record<'pulse' | 'spo2' | 'rr' | 'temp', RegExp> = {
  pulse: /^(hr|pr|pulse|bpm|heart|heartrate)$/i,
  spo2: /^(spo2|sp02|spo₂|spo|o2|sat|sao2|oxygen)$/i,
  rr: /^(rr|resp|rpm|respiration|rrate|awrr)$/i,
  temp: /^(temp|temperature|t1|t2|temp1|temp2|tperi|tcore|tskin)$/i,
};
const UNITS: Record<'pulse' | 'spo2' | 'rr' | 'temp', RegExp> = {
  pulse: /^(bpm|\/min)$/i, spo2: /^%$/, rr: /^(rpm|\/min|br\/min)$/i, temp: /^[°º*']?[cf]$/i,
};

const norm = (t: string) => t.replace(/^(\d{2}),(\d)$/, '$1.$2'); // "36,8" -> "36.8"
const num = (w: Word) => { const t = norm(w.text); return /^\d{2,3}(\.\d)?$/.test(t) ? parseFloat(t) : null; };
const cx = (w: Word) => (w.x0 + w.x1) / 2, cy = (w: Word) => (w.y0 + w.y1) / 2, h = (w: Word) => w.y1 - w.y0;
const inRange = (f: Field, v: number) => v >= RANGE[f][0] && v <= RANGE[f][1];
/** Temperature near a Temp label / unit: degC (30-43) or degF (86-110), also "368" / "986" when the point was lost. Returns degC. */
function tempC(v: number, hasPoint: boolean): number | null {
  // Body temperature is printed with a decimal point. A bare integer such as 98 is almost always another vital (SpO2),
  // so it is NOT taken as a Fahrenheit temperature. Only a 3-digit number whose point was lost (368 / 986) is rescued.
  if (hasPoint) {
    if (v >= 30 && v <= 43) return v;
    if (v >= 86 && v <= 110) return ((v - 32) * 5) / 9;
    return null;
  }
  if (v >= 300 && v <= 430) return v / 10;
  if (v >= 860 && v <= 1100) return ((v / 10 - 32) * 5) / 9;
  return null;
}

type Cand = { field: Field; value: number; source: string; strong: boolean };

export function mergeVitals(words: Word[], imgW: number): Record<Field, Result> {
  const cands: Cand[] = [];
  const nums = words.filter((w) => num(w) !== null);

  // 1) Blood pressure: "113/65" (also "113 / 65" split across words), sys > dia
  const joined = words.map((w) => w.text).join(' ');
  for (const m of joined.matchAll(/(\d{2,3})\s*[\/|]\s*(\d{2,3})/g)) {
    const s = +m[1], d = +m[2];
    if (inRange('sys', s) && inRange('dia', d) && s > d) {
      cands.push({ field: 'sys', value: s, source: 'bp-pattern', strong: true });
      cands.push({ field: 'dia', value: d, source: 'bp-pattern', strong: true });
    }
  }

  // 2) Label pass: pair each small label with the nearest plausible number (right or below preferred).
  //  * Alarm banners ("PR TOO LOW", "SPO2 LEAD OFF") are messages, not labels: a banner "PR" once claimed the RESP
  //    number as the pulse after the real heart rate was dropped.
  //  * A label only claims a number that is plausibly close to it (a few number-heights away).
  //  * If two DIFFERENT numbers are about equally close, the label claims neither (fail closed). For temperature the
  //    two are reported as a conflict so the nurse can pick the channel.
  //  * Two labels for one vital that disagree (HR 154 vs Pulse 153) also end up as a conflict.
  const ALARM = /^(too|high|low|off|alarm|alarms|lead|leads|probe|check|fail|failure|error|sensor|disconnected|search|artifact|noise|apnea|asystole|limit|limits)$/i;
  const isBanner = (l: Word) => words.some((w) => w !== l && Math.abs(cy(w) - cy(l)) < 0.8 * Math.max(h(l), 1) && w.x0 - l.x1 >= -2 && w.x0 - l.x1 <= 2.5 * Math.max(h(l), 1) && ALARM.test(w.text.replace(/[^A-Za-z]/g, '')));
  const sameNum = (a: number, b: number) => Math.abs(a - b) < 0.15;
  const claims: { f: Field; n: Word; cv: number; score: number }[] = [];
  for (const [f, re] of Object.entries(LABELS) as ['pulse' | 'spo2' | 'rr' | 'temp', RegExp][]) {
    for (const l of words.filter((w) => re.test(w.text.replace(/[^\w₂°\/]/g, '')))) {
      if (isBanner(l)) continue;
      const cs: { n: Word; cv: number; score: number }[] = [];
      for (const n of nums) {
        const v = num(n)!;
        const cv = f === 'temp' ? tempC(v, /\./.test(norm(n.text))) : inRange(f, v) ? v : null;
        if (cv === null) continue;
        const dx = cx(n) - cx(l), dy = cy(n) - cy(l);
        const dist = Math.hypot(dx, dy);
        // close enough to belong to the label: a few number-heights, or a few label-heights for small digits (temperature)
        if (dist > Math.min(imgW * 0.35, Math.max(3.5 * h(n), 9 * h(l)))) continue;
        // a number left of / above the label usually belongs to the PREVIOUS parameter (HR sits above the SpO2 label)
        const behind = (dx < -(l.x1 - l.x0) && dy < 0) || dy < -Math.max(h(l), 1) ? 2 : 1;
        cs.push({ n, cv, score: (dist * behind) / Math.sqrt(Math.max(h(n), 1)) });
      }
      if (!cs.length) continue;
      cs.sort((a, b) => a.score - b.score);
      const second = cs.find((c) => !sameNum(c.cv, cs[0].cv));
      if (second && second.score < 1.5 * cs[0].score) {
        if (f === 'temp') {
          cands.push({ field: 'temp', value: cs[0].cv, source: 'label', strong: true }, { field: 'temp', value: second.cv, source: 'label', strong: true });
        }
        continue;
      }
      claims.push({ f, n: cs[0].n, cv: cs[0].cv, score: cs[0].score });
    }
  }
  claims.sort((a, b) => a.score - b.score);
  const used = new Set<Word>();
  for (const c of claims) {
    if (used.has(c.n)) continue; // one number can serve only one vital
    used.add(c.n);
    cands.push({ field: c.f, value: c.cv, source: 'label', strong: true });
  }

  // 3) Unit pass: a number directly beside a unit token (%, bpm, /min, °C)
  for (const n of nums) {
    for (const u of words) {
      if (u === n || Math.abs(cy(u) - cy(n)) > h(n) || u.x0 - n.x1 > h(n) * 2 || u.x0 < n.x0) continue;
      for (const f of Object.keys(UNITS) as (keyof typeof UNITS)[]) {
        const v = num(n)!;
        if (!UNITS[f].test(u.text)) continue;
        if (f === 'temp') {
          const cv = /\./.test(norm(n.text)) ? tempC(v, true) : null;
          if (cv !== null) cands.push({ field: f, value: cv, source: 'unit', strong: true });
        } else if (inRange(f, v)) cands.push({ field: f, value: v, source: 'unit', strong: true });
      }
    }
  }

  // 4) Layout guess (Contec-style, unlabeled big numbers): amber suggestions only
  const big = nums.filter((n) => !used.has(n) && h(n) > 0).sort((a, b) => h(b) - h(a)).slice(0, 4).sort((a, b) => a.y0 - b.y0);
  const order: Field[] = ['pulse', 'spo2', 'rr'];
  for (const n of big) {
    const v = num(n)!;
    const f = order.find((o) => inRange(o, v) && !(o === 'pulse' && v > 100 && false));
    if (f) { cands.push({ field: f, value: v, source: 'layout', strong: false }); order.splice(order.indexOf(f), 1); }
  }

  // 5) Merge: strong reads agree -> read; strong reads disagree -> conflict (blank); weak only -> suggested
  const out = {} as Record<Field, Result>;
  for (const f of Object.keys(RANGE) as Field[]) {
    const mine = cands.filter((c) => c.field === f);
    const strong = [...new Set(mine.filter((c) => c.strong).map((c) => c.value))];
    const weak = [...new Set(mine.filter((c) => !c.strong).map((c) => c.value))];
    const candidates = mine.map((c) => ({ value: c.value, source: c.source }));
    if (strong.length === 1) out[f] = { value: strong[0], status: 'read', candidates };
    else if (strong.length > 1) out[f] = { value: null, status: 'conflict', candidates };
    else if (weak.length >= 1) out[f] = { value: weak[0], status: 'suggested', candidates };
    else out[f] = { value: null, status: 'empty', candidates };
  }
  return out;
}
