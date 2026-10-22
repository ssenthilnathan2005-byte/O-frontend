const KEY = "app_lang";
export type Lang = "en" | "ta";

export function getLang(): Lang {
  try {
    return localStorage.getItem(KEY) === "ta" ? "ta" : "en";
  } catch {
    return "en";
  }
}

function clearCookie() {
  const past = "expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  document.cookie = `googtrans=; ${past}`;
  document.cookie = `googtrans=; ${past}; domain=${location.hostname}`;
}

export function setLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {}
  clearCookie();
  if (lang === "ta") {
    document.cookie = `googtrans=/en/ta; path=/`;
    document.cookie = `googtrans=/en/ta; path=/; domain=${location.hostname}`;
  }
  window.location.reload();
}

// Stops React crashing when Google Translate rewrites the page
function patchDom() {
  const proto = Node.prototype as any;
  const origRemove = proto.removeChild;
  proto.removeChild = function (child: Node) {
    if (child.parentNode !== this) return child;
    return origRemove.call(this, child);
  };
  const origInsert = proto.insertBefore;
  proto.insertBefore = function (newNode: Node, ref: Node | null) {
    if (ref && ref.parentNode !== this) return newNode;
    return origInsert.call(this, newNode, ref);
  };
}

export async function syncWithServer(
  userKey: string,
  serverLang: Lang,
  save: (lang: Lang) => Promise<unknown>
) {
  const markerKey = "app_lang_synced_user";
  let first = false;
  try {
    first = localStorage.getItem(markerKey) !== userKey;
    localStorage.setItem(markerKey, userKey);
  } catch {}
  const local = getLang();
  // First login on this device: keep a Tamil choice made before logging in
  if (first && local === "ta" && serverLang === "en") {
    try { await save("ta"); } catch {}
    return;
  }
  if (serverLang !== local) setLang(serverLang);
}

export function initTranslate() {
  if (getLang() !== "ta") return;
  document.documentElement.classList.add("lang-ta");
  patchDom();

  const holder = document.createElement("div");
  holder.id = "google_translate_element";
  holder.style.display = "none";
  document.body.appendChild(holder);

  (window as any).googleTranslateInit = () => {
    new (window as any).google.translate.TranslateElement(
      { pageLanguage: "en", includedLanguages: "ta,en", autoDisplay: false },
      "google_translate_element"
    );
  };

  const s = document.createElement("script");
  s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateInit";
  s.async = true;
  document.body.appendChild(s);
}
