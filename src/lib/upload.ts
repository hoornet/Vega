import { fetch } from "@tauri-apps/plugin-http";

/**
 * Upload an image file to nostr.build and return the hosted URL.
 * Uses Tauri's HTTP plugin to bypass WebView CORS/fetch restrictions.
 */
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("fileToUpload", file);

  const resp = await fetch("https://nostr.build/api/v2/upload/files", {
    method: "POST",
    body: form,
  });

  if (!resp.ok) {
    throw new Error(`Upload failed (HTTP ${resp.status})`);
  }

  const data = await resp.json();
  if (data.status === "success" && data.data?.[0]?.url) {
    return data.data[0].url as string;
  }
  throw new Error(data.message || "Upload failed — no URL returned");
}
