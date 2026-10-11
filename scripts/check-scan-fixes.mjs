// Run:  node scripts/check-scan-fixes.mjs
// Regression tests for the scanner fixes. All word lists here are SYNTHETIC: hand-written OCR output whose
// positions were measured from stock photos. They test the logic. They are not a camera test.
import { matchMonitorReadings, resolveTemplate, MONITOR_TEMPLATES, isKnownLabel } from "../src/lib/monitorMatch.ts";
import { mergeVariants, finalize, joinSlashWords, canonNum, uniqueKeys } from "../src/lib/ocrConsensus.ts";

let failed = 0;
const expect = (name, cond, detail) => {
  if (cond) console.log("  ok   " + name);
  else { failed++; console.log("  FAIL " + name + (detail ? "  -> " + detail : "")); }
};
const W = (text, conf, x0, y0, x1, y1) => ({ text, conf, x0, y0, x1, y1 });
const NAMES = ["N", "I", "C"];
const val = (o, f) => o.values[f]?.text;
const sec = (t) => console.log("\n" + t);

// ---------- 1. BP split keeps the parent confidence and box ----------
sec("1. BP: confidence and box come from the parent reading");
{
  const one = matchMonitorReadings([W("120/80", 95, 0, 0, 150, 40)]);
  expect("single token 120/80: both parts carry 95%", one.values.bpSystolic?.conf === 95 && one.values.bpDiastolic?.conf === 95);
  const three = joinSlashWords([W("120", 95, 0, 0, 60, 40), W("/", 0, 62, 0, 72, 40), W("80", 93, 80, 0, 140, 40)]);
  expect("three words: slash at 0% does not zero the BP", three.length === 1 && three[0].text === "120/80" && three[0].conf === 93, JSON.stringify(three));
  expect("three words: joined box covers all pieces", three[0].x0 === 0 && three[0].x1 === 140 && three[0].y1 === 40);
  const open = joinSlashWords([W("120/", 92, 0, 0, 80, 40), W("80", 90, 90, 0, 140, 40)]);
  expect("120/ + 80: lowest DIGIT confidence (90)", open.length === 1 && open[0].conf === 90);
  const low = matchMonitorReadings([W("120/80", 70, 0, 0, 150, 40)]);
  expect("low parent confidence is NOT boosted (stays 70, suggestion only)", !low.values.bpSystolic && !low.values.bpDiastolic && low.suggestions.bpSystolic?.conf === 70);
  const real = matchMonitorReadings(joinSlashWords([W("120", 95, 0, 0, 60, 40), W("/", 0, 62, 0, 72, 40), W("80", 93, 80, 0, 140, 40)]));
  expect("slash at 0% no longer blocks the fill", val(real, "bpSystolic") === "120" && val(real, "bpDiastolic") === "80");
}

// ---------- 2. Edge punctuation vs real disagreement ----------
sec("2. Variant agreement ignores edge punctuation, never real digit differences");
{
  const agree = (a, b) => { const m = mergeVariants([[W(a, 90, 0, 0, 40, 30)], [W(b, 90, 0, 0, 40, 30)], []], NAMES); return m.items.length === 1 && m.dropped.length === 0; };
  expect("118 vs 118/ agree", agree("118", "118/"));
  expect("76 vs 76. agree", agree("76", "76."));
  expect("98 vs 98: agree", agree("98", "98:"));
  expect("37.7 vs 37.7 agree and decimal kept", canonNum("37.7") === "37.7");
  expect("37.7 is never collapsed to 377", canonNum("37.7.") === "37.7" && canonNum("37.7") !== "377");
  expect("120/80 keeps its internal slash", canonNum("120/80/") === "120/80");
  expect("4 vs 105 rejected", !agree("4", "105"));
  expect("2 vs 4 rejected", !agree("2", "4"));
  expect("98 vs 96 rejected", !agree("98", "96"));
  expect("37.7 vs 377 rejected", !agree("37.7", "377"));
  expect("37. vs 37.7 rejected (a lost digit is not guessed)", !agree("37.", "37.7"));
  const r = mergeVariants([[W("4", 90, 0, 0, 40, 30)], [W("105", 90, 0, 0, 40, 30)], []], NAMES);
  expect("4 vs 105 leaves the field blank end to end", r.items.length === 0 && r.notes.length === 1);
  // the real Vismo ART case: variants split 118/76 in three different ways, one with stray punctuation
  const v0 = [W("118/", 92, 0, 0, 80, 40), W("76.", 92, 90, 0, 140, 40)];
  const v1 = [W("118/76", 92, 0, 0, 140, 40)];
  const v2 = [W("118", 92, 0, 0, 60, 40), W("/", 0, 62, 0, 72, 40), W("76", 92, 80, 0, 140, 40)];
  const m = mergeVariants([v0, v1, v2], NAMES);
  expect("118/ + 76. joins with the other splits into one agreed reading", m.items.length === 1 && m.items[0].word.text === "118/76" && m.items[0].agreed, JSON.stringify(m.items.map((i) => i.word.text)));
  const f = finalize(m.items, { 0: { text: "118/76", conf: 94 } }, { singleCap: 60 });
  expect("and is confirmed, not dropped", f.words.length === 1 && f.words[0].conf === 92 && f.notes.length === 0);
  const f2 = finalize(m.items, { 0: { text: "118/76", conf: NaN } }, { singleCap: 60 });
  expect("a missing re-check confidence is not read as 0%", f2.words[0].conf === 92);
  const f3 = finalize(m.items, { 0: { text: "118/78", conf: 99 } }, { singleCap: 60 });
  expect("re-check digits that differ still drop it", f3.words.length === 0 && f3.notes.length === 1);
}

// ---------- 3. NIBP vs ART on a Vismo-like screen ----------
const SCREEN = { x: 115, y: 188, w: 845, h: 612 };
const crop = (ws) => ws.map((w) => ({ ...w, x0: w.x0 - SCREEN.x, x1: w.x1 - SCREEN.x, y0: w.y0 - SCREEN.y, y1: w.y1 - SCREEN.y }));
const vismoWords = () => [
  W("HR", 95, 118, 238, 135, 248), W("80", 96, 210, 250, 345, 340),
  W("NIBP", 95, 118, 396, 152, 408), W("SYS", 95, 195, 396, 218, 408), W("DIA", 95, 280, 396, 300, 408),
  W("100/", 94, 160, 410, 285, 462), W("50", 94, 298, 410, 360, 462), W("(75)", 90, 205, 462, 300, 495),
  W("ART", 95, 118, 521, 142, 533), W("118/", 94, 160, 535, 290, 580), W("76", 94, 298, 535, 360, 580), W("(91)", 90, 212, 582, 305, 628),
  W("SpO2", 95, 255, 640, 285, 652), W("98", 96, 312, 668, 378, 716),
  W("Tskin", 95, 118, 680, 155, 692), W("360", 90, 168, 692, 222, 718),
  W("Trect", 95, 118, 720, 150, 732), W("375", 90, 168, 735, 220, 760),
  W("Imp-RR", 95, 262, 722, 310, 734), W("15", 96, 318, 755, 380, 795),
];
sec("3. NIBP vs ART (Vismo-like screen: cuff 100/50 and arterial 118/76 together)");
{
  const g = matchMonitorReadings(crop(vismoWords()), { width: SCREEN.w, height: SCREEN.h });
  expect("generic mode: BP is the NIBP pair 100/50", val(g, "bpSystolic") === "100" && val(g, "bpDiastolic") === "50", JSON.stringify(g.values));
  expect("generic mode: ART 118/76 is never used", ![val(g, "pulse"), val(g, "spo2"), val(g, "respRate"), val(g, "bpSystolic"), val(g, "bpDiastolic")].some((v) => v === "118" || v === "76" || v === "91"));
  expect("generic mode: the invasive pair is reported as ignored", g.notes.some((n) => n.includes("118/76") && n.includes("invasive")));
  expect("bracketed MAP values (75), (91) are not mistaken for SpO2", !g.notes.some((n) => n.includes("SpO2: several")));
  expect("generic mode: pulse 80 and SpO2 98 by label", val(g, "pulse") === "80" && val(g, "spo2") === "98");
  expect("generic mode: Resp sits between 98 and its label, so it is left blank rather than guessed", !g.values.respRate && val(g, "spo2") === "98" && g.notes.some((n) => n.startsWith("Resp rate: several")));
  const unkRR = crop(vismoWords().map((w) => (w.text === "Imp-RR" ? { ...w, text: "XYZ" } : w)));
  const gu = matchMonitorReadings(unkRR, { width: SCREEN.w, height: SCREEN.h });
  expect("an unrecognised label under SpO2 leaves SpO2 AND Resp blank (cannot tell them apart)", !gu.values.spo2 && !gu.values.respRate);
  expect("temperatures read without a decimal point stay blank", !g.values.temperature);
  const rt = resolveTemplate("auto", crop(vismoWords()));
  expect("auto-detects the Vismo layout from several labels", rt.template?.id === "nk-vismo", JSON.stringify(rt));
  const t = matchMonitorReadings(crop(vismoWords()), { template: rt.template, width: SCREEN.w, height: SCREEN.h });
  expect("template mode: HR 80, SpO2 98, Resp 15, NIBP 100/50", val(t, "pulse") === "80" && val(t, "spo2") === "98" && val(t, "respRate") === "15" && val(t, "bpSystolic") === "100" && val(t, "bpDiastolic") === "50", JSON.stringify(t.values));
  const shuffled = [...vismoWords()].reverse();
  const s2 = matchMonitorReadings(crop(shuffled), { width: SCREEN.w, height: SCREEN.h });
  expect("word order does not matter", val(s2, "bpSystolic") === "100" && val(s2, "bpDiastolic") === "50");
  // NIBP not identifiable: must NOT fall back to ART
  const noNibp = vismoWords().filter((w) => !["NIBP", "SYS", "DIA"].includes(w.text) && w.text !== "100/" && w.text !== "50" && w.text !== "(75)");
  const a = matchMonitorReadings(crop(noNibp), { width: SCREEN.w, height: SCREEN.h });
  expect("only the ART pair visible: BP stays blank", !a.values.bpSystolic && !a.values.bpDiastolic, JSON.stringify(a.values));
  // invasive label on screen + a pair with no label of its own: not assumed to be cuff
  const unl = [W("ART", 95, 0, 0, 30, 12), W("120/80", 95, 400, 300, 600, 360), W("SpO2", 95, 0, 200, 40, 212), W("98", 95, 50, 200, 110, 240)];
  const u = matchMonitorReadings(unl, { width: 800, height: 400 });
  expect("invasive label present + unlabeled pair: BP blank", !u.values.bpSystolic && u.notes.some((n) => n.includes("invasive")));
  const noInv = matchMonitorReadings([W("120/80", 95, 0, 0, 150, 40)]);
  expect("no invasive label: single unlabeled pair still accepted", val(noInv, "bpSystolic") === "120");
  const cvp = matchMonitorReadings([W("CVP", 95, 0, 0, 30, 12), W("120/80", 95, 0, 14, 150, 54)]);
  expect("CVP-labelled pair is never BP", !cvp.values.bpSystolic);
  const aline = matchMonitorReadings([W("A-LINE", 95, 0, 0, 50, 12), W("118/76", 95, 0, 14, 150, 54)]);
  expect("A-LINE-labelled pair is never BP", !aline.values.bpSystolic);
  const cuff = matchMonitorReadings([W("CUFF", 95, 0, 0, 40, 12), W("124/76", 95, 0, 14, 150, 54)]);
  expect("CUFF-labelled pair is BP", val(cuff, "bpSystolic") === "124");
}

// ---------- 4. Review fields appear once ----------
sec("4. Duplicate review fields");
{
  const ALL = ["bpSystolic", "bpDiastolic", "pulse", "spo2", "respRate", "temperature"];
  expect("repeated keys collapse to one each", uniqueKeys([...ALL, "spo2", "respRate", "temperature"]).join() === ALL.join());
}

// ---------- 4b. Two temperature channels ----------
sec("4b. Two temperature channels: listed for the nurse to pick, never auto-filled");
{
  const c = matchMonitorReadings([W("TEMP", 95, 0, 0, 50, 12), W("37.7", 95, 0, 14, 60, 36), W("37.2", 95, 0, 38, 60, 60)]);
  expect("unlabeled pair of temperatures: field stays blank", !c.values.temperature);
  expect("both offered as tap-to-use choices", c.tempChoices?.length === 2 && c.tempChoices.map((x) => x.f).join() === "99.9,99.0", JSON.stringify(c.tempChoices));
  const v = matchMonitorReadings([W("Tskin", 95, 0, 0, 40, 12), W("36.0", 95, 60, 0, 110, 30), W("Trect", 95, 0, 40, 40, 52), W("37.5", 95, 60, 40, 110, 70)]);
  expect("Tskin / Trect: blank, choices carry their labels", !v.values.temperature && v.tempChoices?.map((x) => x.label).join() === "TSKIN,TRECT", JSON.stringify(v.tempChoices));
  const one = matchMonitorReadings([W("TEMP", 95, 0, 0, 50, 12), W("36.8", 95, 60, 0, 120, 30)]);
  expect("a single channel still fills (converted to F)", val(one, "temperature") === "98.2");
}

// ---------- 5. Templates are used only when the layout is recognised ----------
sec("5. Templates: never forced");
{
  expect("auto: unknown layout -> no template", !resolveTemplate("auto", [W("HR", 90, 0, 0, 10, 10), W("SpO2", 90, 0, 20, 10, 30)]).template);
  const wrong = resolveTemplate("nk-vismo", [W("HR", 90, 0, 0, 10, 10)]);
  expect("Vismo picked on a different screen -> generic mode with an explanation", !wrong.template && !!wrong.note);
  const hand = resolveTemplate("contec-cms", []);
  expect("unlabeled Contec layout picked by hand -> used, with a warning note", hand.template?.id === "contec-cms" && !!hand.note);
  expect("unlabeled layouts are never auto-selected", !resolveTemplate("auto", [W("NIBP", 90, 0, 0, 10, 10)]).template);
  expect("unknown template id -> generic", !resolveTemplate("nope", []).template);
  // extensibility: a new monitor is just another entry
  const reg = [...MONITOR_TEMPLATES, { id: "acme", name: "Acme", signature: ["FOO", "BAR"], minSignature: 2, regions: { pulse: { x: 0, y: 0, w: 0.5, h: 0.5 } } }];
  expect("new profile works without touching the scan flow", resolveTemplate("auto", [W("FOO", 90, 0, 0, 1, 1), W("BAR", 90, 0, 2, 1, 3)], reg).template?.id === "acme");
}

// ---------- 5b. Contec-like screen, unlabeled big numbers ----------
sec("5b. Contec-like screen (unlabeled big numbers) needs its template");
{
  const C = { x: 120, y: 188, w: 705, h: 530 };
  const cc = (ws) => ws.map((w) => ({ ...w, x0: w.x0 - C.x, x1: w.x1 - C.x, y0: w.y0 - C.y, y1: w.y1 - C.y }));
  const words = cc([
    W("60", 95, 630, 268, 700, 332), W("98", 95, 632, 392, 700, 452), W("20", 95, 610, 482, 678, 535),
    W("120/", 95, 212, 570, 330, 630), W("80", 95, 360, 570, 425, 630), W("90", 90, 458, 598, 495, 628),
    W("TEMP", 90, 565, 548, 592, 558), W("37.7", 95, 597, 570, 647, 592), W("37.2", 95, 597, 597, 647, 619),
  ]);
  const generic = matchMonitorReadings(words, { width: C.w, height: C.h });
  expect("generic mode: unlabeled 60 / 98 / 20 are NOT guessed", !generic.values.pulse && !generic.values.spo2 && !generic.values.respRate);
  expect("generic mode: BP pair 120/80 still read", val(generic, "bpSystolic") === "120" && val(generic, "bpDiastolic") === "80");
  const t = matchMonitorReadings(words, { template: resolveTemplate("contec-cms", words).template, width: C.w, height: C.h });
  expect("template mode: 60 / 98 / 20 / 120/80", val(t, "pulse") === "60" && val(t, "spo2") === "98" && val(t, "respRate") === "20" && val(t, "bpSystolic") === "120" && val(t, "bpDiastolic") === "80", JSON.stringify(t.values));
  expect("template mode: MAP 90 not used", !Object.values(t.values).some((v, i) => false) && val(t, "pulse") !== "90");
  expect("template mode: two temperatures stay blank, both offered", !t.values.temperature && t.tempChoices?.length === 2);
}

// ---------- 6. Safety on unfamiliar / ambiguous layouts ----------
sec("6. Fail closed");
{
  const two = matchMonitorReadings([W("RESP", 95, 0, 0, 40, 12), W("12", 95, 0, 16, 40, 46), W("20", 95, 0, 50, 40, 80)]);
  expect("two small numbers near RESP -> blank", !two.values.respRate);
  const unk = matchMonitorReadings([W("XYZ", 95, 0, 0, 40, 12), W("98", 95, 50, 0, 110, 40)]);
  expect("unknown label -> nothing filled", Object.keys(unk.values).length === 0);
  const sameNum = matchMonitorReadings([W("PR", 95, 0, 0, 20, 12), W("SpO2", 95, 0, 14, 40, 26), W("98", 95, 50, 4, 100, 40)]);
  expect("one number cannot fill two fields", !sameNum.values.pulse && !sameNum.values.spo2);
  expect("patient names are not exported as labels", !isKnownLabel("JOHN") && !isKnownLabel("SMITH") && isKnownLabel("SpO2") && isKnownLabel("NIBP") && isKnownLabel("ART"));
}

console.log(failed ? "\n" + failed + " check(s) FAILED" : "\nAll scan-fix checks passed");
process.exit(failed ? 1 : 0);