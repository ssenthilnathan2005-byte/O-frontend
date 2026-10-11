/**
 * SAMPLE DATA - FOR DEVELOPMENT AND TESTING ONLY.
 *
 * These are hand-estimated OCR word boxes for two public reference photos of patient monitors
 * (a multiparameter bedside monitor and a spot-check monitor). The numbers on those screens are
 * demo values, NOT patient data. They only exist so the label-matching logic can be tested
 * without a camera or a real monitor. Replace/extend them with real OCR output from the monitors
 * used in hospital before relying on the scanner.
 *
 * Word = [text, confidence, x0, y0, x1, y1]
 */
type W = [string, number, number, number, number, number];

export const SAMPLE_BEDSIDE_MONITOR: { name: string; width: number; height: number; words: W[] } = {
  name: "SAMPLE - bedside multiparameter monitor (blue/green display, NIBP 120/80)",
  width: 736,
  height: 600,
  words: [
    ["ECG", 90, 413, 102, 440, 112],
    ["60", 92, 462, 140, 512, 182],
    ["120", 70, 413, 172, 430, 180],
    ["50", 70, 413, 185, 425, 193],
    ["SPO2", 90, 411, 203, 440, 213],
    ["PR", 88, 456, 203, 468, 213],
    ["60", 70, 472, 203, 484, 213],
    ["98", 91, 462, 232, 512, 275],
    ["100", 70, 413, 255, 430, 263],
    ["90", 70, 413, 268, 425, 276],
    ["RESP", 90, 411, 296, 441, 306],
    ["20", 90, 447, 297, 497, 340],
    ["TEMP", 90, 411, 350, 437, 360],
    ["37.7", 88, 437, 366, 473, 381],
    ["37.2", 88, 437, 388, 473, 403],
    ["39.0", 65, 491, 368, 515, 378],
    ["0.5", 80, 540, 380, 566, 398],
    ["NIBP", 90, 55, 342, 80, 352],
    ["120/", 90, 140, 368, 222, 410],
    ["80", 91, 255, 368, 305, 410],
    ["90", 88, 330, 388, 358, 410],
    ["160", 60, 92, 411, 106, 419],
  ],
};

export const SAMPLE_SPOT_CHECK_MONITOR: { name: string; width: number; height: number; words: W[] } = {
  name: "SAMPLE - spot-check monitor (white-on-black LCD, 180/90, SpO2 99, PR 86, 36.5 C)",
  width: 1080,
  height: 820,
  words: [
    ["180", 90, 560, 165, 718, 218],
    ["SYST", 88, 762, 176, 815, 196],
    ["<MAP>", 80, 755, 197, 812, 209],
    ["90", 90, 560, 225, 680, 278],
    ["DIAS", 88, 722, 237, 765, 257],
    ["99", 91, 505, 283, 625, 330],
    ["SpO2", 86, 678, 302, 725, 322],
    ["86", 90, 505, 338, 585, 385],
    ["PR", 88, 646, 358, 672, 376],
    ["36.5", 89, 450, 390, 555, 440],
    ["TEMP", 88, 616, 402, 672, 424],
    ["98", 70, 372, 340, 410, 352],
    ["100", 70, 365, 355, 410, 370],
  ],
};