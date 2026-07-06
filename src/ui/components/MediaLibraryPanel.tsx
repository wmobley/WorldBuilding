import { useEffect, useMemo, useState } from "react";
import type { Asset } from "../../vault/types";
import { createSignedAssetUrl, isImageAsset } from "../../vault/assets";

function formatBytes(value?: number | null) {
  if (!value) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function AssetPreview({ asset }: { asset: Asset }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    createSignedAssetUrl(asset.storagePath)
      .then((signedUrl) => {
        if (active) setUrl(signedUrl);
      })
      .catch(() => {
        if (active) setUrl(null);
      });
    return () => {
      active = false;
    };
  }, [asset.storagePath]);

  if (!isImageAsset(asset)) {
    return (
      <div className="flex h-24 items-center justify-center rounded-xl border border-page-edge bg-parchment/70 text-xs font-ui uppercase tracking-[0.16em] text-ink-soft">
        File
      </div>
    );
  }

  if (!url) {
    return (
      <div className="h-24 animate-pulse rounded-xl border border-page-edge bg-parchment/70" />
    );
  }

  return (
    <img
      src={url}
      alt={asset.altText || asset.filename}
      className="h-24 w-full rounded-xl border border-page-edge object-cover"
    />
  );
}

type AssetDraft = {
  filename: string;
  altText: string;
};

export default function MediaLibraryPanel({
  assets,
  onUpload,
  onUpdate,
  onReplace,
  onInsert,
  onInsertGallery,
  onDelete
}: {
  assets: Asset[];
  onUpload: (file: File, altText: string) => Promise<void>;
  onUpdate: (
    asset: Asset,
    updates: { filename?: string; altText?: string | null }
  ) => Promise<void>;
  onReplace: (asset: Asset, file: File) => Promise<void>;
  onInsert: (asset: Asset) => void;
  onInsertGallery: (assets: Asset[]) => void;
  onDelete: (asset: Asset) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, AssetDraft>>({});
  const sortedAssets = useMemo(
    () => assets.slice().sort((a, b) => b.createdAt - a.createdAt),
    [assets]
  );
  const selectedAssets = sortedAssets.filter((asset) => selectedIds.has(asset.id));

  useEffect(() => {
    setDrafts((current) => {
      const next: Record<string, AssetDraft> = {};
      assets.forEach((asset) => {
        next[asset.id] = current[asset.id] ?? {
          filename: asset.filename,
          altText: asset.altText ?? ""
        };
      });
      return next;
    });
  }, [assets]);

  const handleUpload = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      await onUpload(file, altText);
      setFile(null);
      setAltText("");
    } catch {
      setError("Upload failed. Check local Supabase Storage and try again.");
    } finally {
      setBusy(false);
    }
  };

  const toggleSelected = (assetId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  };

  return (
    <section
      id="page-media-library"
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const droppedFile = event.dataTransfer.files?.[0] ?? null;
        if (droppedFile) setFile(droppedFile);
      }}
      className="rounded-2xl border border-page-edge bg-parchment/70 p-4"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs font-ui uppercase tracking-[0.18em] text-ember">
            Media Library
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            Upload or drop campaign assets, update metadata, replace files, and insert embeds.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-ui uppercase tracking-[0.18em]">
          <span className="rounded-full border border-page-edge px-3 py-1 text-ink-soft">
            {assets.length} assets
          </span>
          <button
            type="button"
            disabled={selectedAssets.length < 2}
            onClick={() => onInsertGallery(selectedAssets)}
            className="rounded-full border border-page-edge px-3 py-1 text-ink-soft enabled:hover:text-ember disabled:opacity-50"
          >
            Insert Gallery ({selectedAssets.length})
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)_auto]">
        <label className="text-xs font-ui uppercase tracking-[0.16em] text-ink-soft">
          File
          <input
            type="file"
            accept="image/*,application/pdf,audio/*,video/*"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="mt-1 block w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm normal-case tracking-normal"
          />
        </label>
        <label className="text-xs font-ui uppercase tracking-[0.16em] text-ink-soft">
          Caption / Alt Text
          <input
            type="text"
            value={altText}
            onChange={(event) => setAltText(event.target.value)}
            placeholder={file?.name ?? "Optional caption"}
            className="mt-1 w-full rounded-xl border border-page-edge bg-parchment/80 px-3 py-2 text-sm normal-case tracking-normal"
          />
        </label>
        <button
          type="button"
          onClick={() => handleUpload().catch(() => undefined)}
          disabled={!file || busy}
          className="self-end rounded-xl border border-ember/30 bg-ember/10 px-4 py-2 text-xs font-ui uppercase tracking-[0.18em] text-ember disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Uploading" : "Upload"}
        </button>
      </div>
      {file && (
        <p className="marginal-note mt-2">
          Ready to upload: {file.name} {formatBytes(file.size)}
        </p>
      )}
      {error && <div className="mt-2 text-xs text-ember">{error}</div>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sortedAssets.slice(0, 9).map((asset) => {
          const draft = drafts[asset.id] ?? {
            filename: asset.filename,
            altText: asset.altText ?? ""
          };
          return (
            <div
              key={asset.id}
              className="rounded-2xl border border-page-edge bg-parchment/80 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs font-ui uppercase tracking-[0.14em] text-ink-soft">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(asset.id)}
                    onChange={() => toggleSelected(asset.id)}
                  />
                  Gallery
                </label>
                <div className="truncate text-[10px] text-ink-soft">
                  {asset.sizeBytes ? formatBytes(asset.sizeBytes) : ""}
                </div>
              </div>
              <AssetPreview asset={asset} />
              <div className="mt-3 space-y-2">
                <label className="block text-[10px] font-ui uppercase tracking-[0.14em] text-ink-soft">
                  Filename
                  <input
                    value={draft.filename}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [asset.id]: { ...draft, filename: event.target.value }
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-page-edge bg-parchment/80 px-2 py-1 text-xs normal-case tracking-normal text-ink"
                  />
                </label>
                <label className="block text-[10px] font-ui uppercase tracking-[0.14em] text-ink-soft">
                  Caption
                  <input
                    value={draft.altText}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [asset.id]: { ...draft, altText: event.target.value }
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-page-edge bg-parchment/80 px-2 py-1 text-xs normal-case tracking-normal text-ink"
                  />
                </label>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onInsert(asset)}
                  className="rounded-xl border border-page-edge px-3 py-2 text-xs font-ui uppercase tracking-[0.16em] text-ink-soft hover:text-ember"
                >
                  Insert
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBusy(true);
                    onUpdate(asset, {
                      filename: draft.filename,
                      altText: draft.altText.trim() || null
                    })
                      .catch(() => setError("Save failed. Check asset permissions."))
                      .finally(() => setBusy(false));
                  }}
                  className="rounded-xl border border-page-edge px-3 py-2 text-xs font-ui uppercase tracking-[0.16em] text-ink-soft hover:text-ember"
                >
                  Save
                </button>
                <label className="rounded-xl border border-page-edge px-3 py-2 text-center text-xs font-ui uppercase tracking-[0.16em] text-ink-soft hover:text-ember">
                  Replace
                  <input
                    type="file"
                    accept="image/*,application/pdf,audio/*,video/*"
                    className="sr-only"
                    onChange={(event) => {
                      const replacement = event.target.files?.[0] ?? null;
                      if (!replacement) return;
                      setBusy(true);
                      onReplace(asset, replacement)
                        .catch(() => setError("Replace failed. Check Storage permissions."))
                        .finally(() => {
                          setBusy(false);
                          event.target.value = "";
                        });
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setBusy(true);
                    onDelete(asset)
                      .catch(() => setError("Delete failed. Check Storage permissions."))
                      .finally(() => setBusy(false));
                  }}
                  className="rounded-xl border border-page-edge px-3 py-2 text-xs font-ui uppercase tracking-[0.16em] text-ink-soft hover:text-ember"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
        {sortedAssets.length === 0 && (
          <p className="marginal-note sm:col-span-2 xl:col-span-3">
            No media yet. Upload an image, handout, audio clip, or map crop.
          </p>
        )}
      </div>
      {sortedAssets.length > 9 && (
        <p className="marginal-note mt-3">
          Showing the 9 newest assets. Older assets remain available in campaign storage.
        </p>
      )}
    </section>
  );
}
