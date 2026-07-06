import { supabase } from "../lib/supabase";
import type { Asset } from "./types";

export const ASSET_BUCKET = "campaign-assets";

export function sanitizeStorageFilename(filename: string) {
  const trimmed = filename.trim() || "asset";
  const parts = trimmed.split(".");
  const extension = parts.length > 1 ? parts.pop() : "";
  const basename = parts.join(".") || trimmed;
  const safeBase = basename
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "asset";
  const safeExtension = extension?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return safeExtension ? `${safeBase}.${safeExtension}` : safeBase;
}

export function buildAssetStoragePath(campaignId: string, assetId: string, filename: string) {
  return `${campaignId}/${assetId}-${sanitizeStorageFilename(filename)}`;
}

export function buildMapStoragePath(campaignId: string, mapId: string, filename: string) {
  return `${campaignId}/maps/${mapId}-${sanitizeStorageFilename(filename)}`;
}

export function assetEmbedTarget(asset: Asset) {
  return `asset:${asset.id}`;
}

export function assetEmbedMarkdown(asset: Asset) {
  const label = asset.altText?.trim() || asset.filename;
  return `![[${assetEmbedTarget(asset)}|${label}]]`;
}

export function assetGalleryMarkdown(assets: Asset[]) {
  return `{{gallery: ${assets.map(assetEmbedTarget).join(", ")}}}`;
}

export function isImageAsset(asset: Pick<Asset, "contentType" | "filename">) {
  if (asset.contentType?.startsWith("image/")) return true;
  return /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(asset.filename);
}

export async function createSignedAssetUrl(storagePath: string, expiresIn = 60 * 60) {
  const { data, error } = await supabase.storage
    .from(ASSET_BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
