import { adminApiFetch, formatAdminApiMessage } from "@/lib/admin-api-fetch";
import { formatNetworkError } from "@/lib/api-error";
import { resizeImageForUpload } from "./resize-image-for-upload";

export type CmsUploadResult =
  | { ok: true; url: string }
  | { ok: false; message: string };

export async function uploadImageToCms(file: File, maxEdge: number): Promise<CmsUploadResult> {
  try {
    const prepared = await resizeImageForUpload(file, maxEdge);
    const fd = new FormData();
    fd.append("file", prepared);
    const r = await adminApiFetch("/api/admin/cms/upload", { method: "POST", body: fd });
    let data: { url?: string; message?: string } = {};
    try {
      data = (await r.json()) as { url?: string; message?: string };
    } catch {
      /* non-JSON */
    }
    if (!r.ok) {
      return { ok: false, message: formatAdminApiMessage(r.status, data.message) };
    }
    if (!data.url) {
      return { ok: false, message: "No URL returned from server." };
    }
    return { ok: true, url: data.url };
  } catch (err) {
    return { ok: false, message: formatNetworkError(err, "admin") };
  }
}
