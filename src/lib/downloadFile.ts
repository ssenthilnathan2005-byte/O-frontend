import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

/**
 * Saves a Blob as a file, working correctly both in a regular browser
 * and inside the Capacitor native app (Android/iOS).
 *
 * - Web: triggers the normal browser download via a temporary <a> tag.
 * - Native: writes the file to app cache storage, then opens the native
 *   Share sheet so the user can save/open it (Files, Drive, WhatsApp, etc).
 */
export async function downloadFile(blob: Blob, filename: string) {
  if (!Capacitor.isNativePlatform()) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    return;
  }

  // Native platform: convert blob -> base64, write to cache, then share.
  const base64Data = await blobToBase64(blob);
  const write = await Filesystem.writeFile({
    path: filename,
    data: base64Data,
    directory: Directory.Cache,
  });

  await Share.share({
    title: filename,
    url: write.uri,
    dialogTitle: `Save or share ${filename}`,
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // result is a data URL like "data:application/...;base64,AAAA" — strip the prefix
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
