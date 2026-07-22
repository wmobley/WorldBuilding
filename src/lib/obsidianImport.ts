import JSZip from "jszip";

export type ObsidianImportLimits = {
  maxZipBytes: number;
  maxEntries: number;
  maxMarkdownFileBytes: number;
  maxMarkdownBytes: number;
  maxImageFileBytes: number;
  maxImages: number;
};

export type ObsidianImportSkippedFile = {
  sourcePath: string;
  reason:
    | "directory"
    | "hidden-system-path"
    | "unsafe-path"
    | "outside-root"
    | "unsupported-file"
    | "markdown-too-large"
    | "image-too-large"
    | "too-many-images";
  sizeBytes?: number;
};

export type ObsidianImportWarning = {
  code: "duplicate-title" | "limit-warning" | "empty-import";
  message: string;
  sourcePath?: string;
};

export type ObsidianDocCandidate = {
  sourcePath: string;
  title: string;
  folderPath: string[];
  body: string;
  contentHash: string;
  sizeBytes: number;
};

export type ObsidianImageCandidate = {
  sourcePath: string;
  filename: string;
  contentType: string;
  file: File;
  contentHash: string;
  sizeBytes: number;
};

export type ObsidianImportPreview = {
  docs: ObsidianDocCandidate[];
  images: ObsidianImageCandidate[];
  skipped: ObsidianImportSkippedFile[];
  warnings: ObsidianImportWarning[];
  stats: {
    totalEntries: number;
    markdownBytes: number;
    strippedArchiveRoot?: string;
  };
};

export type ParsedGithubRepo = {
  owner: string;
  repo: string;
  branch: string;
  rootPath: string;
  displayName: string;
  archiveUrl: string;
  sourceKey: string;
};

export const DEFAULT_OBSIDIAN_IMPORT_LIMITS: ObsidianImportLimits = {
  maxZipBytes: 50 * 1024 * 1024,
  maxEntries: 5000,
  maxMarkdownFileBytes: 2 * 1024 * 1024,
  maxMarkdownBytes: 20 * 1024 * 1024,
  maxImageFileBytes: 50 * 1024 * 1024,
  maxImages: 500
};

const systemDirectories = new Set([
  ".git",
  ".obsidian",
  ".stfolder",
  ".trash",
  "__macosx",
  "node_modules"
]);

const imageContentTypes = new Map([
  [".avif", "image/avif"],
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"]
]);

export function normalizeVaultPath(rawPath: string): string | null {
  const normalized = rawPath.replace(/\\/g, "/").trim();
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0")) return null;
  if (/^[A-Za-z]:\//.test(normalized)) return null;
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.some((part) => part === "." || part === ".." || part.includes("\0"))) {
    return null;
  }
  return parts.join("/");
}

export function hasHiddenOrSystemSegment(path: string) {
  return path.split("/").some((segment) => {
    const lower = segment.toLowerCase();
    return lower.startsWith(".") || systemDirectories.has(lower);
  });
}

export function getImageContentType(path: string) {
  const lower = path.toLowerCase();
  const extension = lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : "";
  return imageContentTypes.get(extension) ?? null;
}

export function isSupportedImagePath(path: string) {
  return Boolean(getImageContentType(path));
}

export function createZipSourceKey(filename: string) {
  return `zip:${filename.trim().toLowerCase() || "obsidian-vault.zip"}`;
}

export function parseGithubRepoUrl(
  rawUrl: string,
  branchInput = "main",
  rootPathInput = ""
): ParsedGithubRepo {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("Enter a valid GitHub repository URL.");
  }
  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
    throw new Error("Only public github.com repository URLs are supported.");
  }
  const segments = url.pathname.split("/").filter(Boolean);
  const owner = segments[0];
  const repo = segments[1]?.replace(/\.git$/i, "");
  if (!owner || !repo) {
    throw new Error("Enter a GitHub repository URL in owner/repo form.");
  }

  let branch = branchInput.trim() || "main";
  let rootPath = rootPathInput.trim();
  if (segments[2] === "tree" && segments[3] && !branchInput.trim()) {
    branch = segments[3];
    rootPath = segments.slice(4).join("/");
  }
  const normalizedRoot = rootPath ? normalizeVaultPath(rootPath) : "";
  if (rootPath && !normalizedRoot) {
    throw new Error("The vault root path contains unsupported path segments.");
  }
  const encodedBranch = branch.split("/").map(encodeURIComponent).join("/");
  const archiveUrl = `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${encodedBranch}`;
  const sourceKey = `github:${owner.toLowerCase()}/${repo.toLowerCase()}:${branch}:${normalizedRoot}`;
  return {
    owner,
    repo,
    branch,
    rootPath: normalizedRoot ?? "",
    displayName: `${owner}/${repo}${normalizedRoot ? `/${normalizedRoot}` : ""}`,
    archiveUrl,
    sourceKey
  };
}

export async function hashText(value: string) {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.subtle) {
    const bytes = new TextEncoder().encode(value);
    const digest = await cryptoApi.subtle.digest("SHA-256", bytes);
    return `sha256:${Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")}`;
  }

  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

async function hashBytes(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const buffer = copy.buffer;
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.subtle) {
    const digest = await cryptoApi.subtle.digest("SHA-256", buffer);
    return `sha256:${Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")}`;
  }

  let hash = 2166136261;
  bytes.forEach((byte) => {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  });
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function stripSharedArchiveRoot(paths: string[]) {
  if (paths.length === 0) return { paths, root: undefined };
  const parts = paths.map((path) => path.split("/"));
  if (parts.some((segments) => segments.length < 2)) {
    return { paths, root: undefined };
  }
  const root = parts[0][0];
  if (!root || parts.some((segments) => segments[0] !== root)) {
    return { paths, root: undefined };
  }
  return {
    paths: parts.map((segments) => segments.slice(1).join("/")),
    root
  };
}

function stripPathRoot(path: string, root?: string) {
  if (!root) return path;
  return path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
}

function applyRootPath(path: string, rootPath: string) {
  if (!rootPath) return path;
  if (path === rootPath) return null;
  if (!path.startsWith(`${rootPath}/`)) return null;
  return path.slice(rootPath.length + 1);
}

function titleFromPath(path: string) {
  const filename = path.split("/").pop() ?? "Untitled";
  return filename.replace(/\.md$/i, "").trim() || "Untitled";
}

function makeFile(bytes: Uint8Array, filename: string, contentType: string) {
  const fileBytes = new Uint8Array(bytes.byteLength);
  fileBytes.set(bytes);
  return new File([fileBytes], filename, { type: contentType });
}

export async function parseObsidianZip(
  archive: Blob,
  options: {
    rootPath?: string;
    limits?: Partial<ObsidianImportLimits>;
  } = {}
): Promise<ObsidianImportPreview> {
  const limits = { ...DEFAULT_OBSIDIAN_IMPORT_LIMITS, ...options.limits };
  if (archive.size > limits.maxZipBytes) {
    throw new Error("The selected archive is too large to import in the browser.");
  }
  const rootPath = options.rootPath ? normalizeVaultPath(options.rootPath) : "";
  if (options.rootPath && !rootPath) {
    throw new Error("The vault root path contains unsupported path segments.");
  }

  const zip = await JSZip.loadAsync(archive);
  const entries = Object.values(zip.files);
  if (entries.length > limits.maxEntries) {
    throw new Error("The selected archive has too many files to import in the browser.");
  }

  const skipped: ObsidianImportSkippedFile[] = [];
  const warnings: ObsidianImportWarning[] = [];
  const normalizedEntries = entries
    .map((entry) => {
      const rawName = entry.unsafeOriginalName ?? entry.name;
      const normalized = normalizeVaultPath(rawName);
      if (entry.dir) {
        skipped.push({ sourcePath: rawName, reason: "directory" });
        return null;
      }
      if (!normalized) {
        skipped.push({ sourcePath: rawName, reason: "unsafe-path" });
        return null;
      }
      return { entry, normalized };
    })
    .filter(
      (item): item is { entry: JSZip.JSZipObject; normalized: string } => item !== null
    );

  const stripCandidates = normalizedEntries
    .map((item) => item.normalized)
    .filter((path) => {
      const topLevel = path.split("/")[0]?.toLowerCase() ?? "";
      return !topLevel.startsWith(".") && !systemDirectories.has(topLevel);
    });
  const stripped = stripSharedArchiveRoot(stripCandidates);
  const entriesByStrippedPath = new Map(
    normalizedEntries.map((item) => [stripPathRoot(item.normalized, stripped.root), item.entry])
  );
  const docs: ObsidianDocCandidate[] = [];
  const images: ObsidianImageCandidate[] = [];
  let markdownBytes = 0;

  for (const [strippedPath, entry] of entriesByStrippedPath) {
    if (!strippedPath) continue;
    const rootedPath = applyRootPath(strippedPath, rootPath ?? "");
    if (!rootedPath) {
      skipped.push({ sourcePath: strippedPath, reason: "outside-root" });
      continue;
    }
    if (hasHiddenOrSystemSegment(rootedPath)) {
      skipped.push({ sourcePath: rootedPath, reason: "hidden-system-path" });
      continue;
    }

    if (/\.md$/i.test(rootedPath)) {
      const body = await entry.async("string");
      const sizeBytes = new Blob([body]).size;
      if (sizeBytes > limits.maxMarkdownFileBytes) {
        skipped.push({ sourcePath: rootedPath, reason: "markdown-too-large", sizeBytes });
        continue;
      }
      markdownBytes += sizeBytes;
      if (markdownBytes > limits.maxMarkdownBytes) {
        throw new Error("The selected archive contains too much Markdown to import at once.");
      }
      const parts = rootedPath.split("/");
      docs.push({
        sourcePath: rootedPath,
        title: titleFromPath(rootedPath),
        folderPath: parts.slice(0, -1),
        body,
        contentHash: await hashText(body),
        sizeBytes
      });
      continue;
    }

    const contentType = getImageContentType(rootedPath);
    if (contentType) {
      if (images.length >= limits.maxImages) {
        skipped.push({ sourcePath: rootedPath, reason: "too-many-images" });
        continue;
      }
      const bytes = await entry.async("uint8array");
      if (bytes.byteLength > limits.maxImageFileBytes) {
        skipped.push({
          sourcePath: rootedPath,
          reason: "image-too-large",
          sizeBytes: bytes.byteLength
        });
        continue;
      }
      const filename = rootedPath.split("/").pop() ?? "image";
      const file = makeFile(bytes, filename, contentType);
      images.push({
        sourcePath: rootedPath,
        filename,
        contentType,
        file,
        contentHash: await hashBytes(bytes),
        sizeBytes: file.size
      });
      continue;
    }

    skipped.push({ sourcePath: rootedPath, reason: "unsupported-file" });
  }

  const titles = new Map<string, ObsidianDocCandidate[]>();
  docs.forEach((doc) => {
    const key = doc.title.toLowerCase();
    titles.set(key, [...(titles.get(key) ?? []), doc]);
  });
  titles.forEach((matches) => {
    if (matches.length < 2) return;
    matches.forEach((doc) => {
      warnings.push({
        code: "duplicate-title",
        sourcePath: doc.sourcePath,
        message: `Duplicate Obsidian title "${doc.title}" may make wikilinks ambiguous.`
      });
    });
  });
  if (docs.length === 0) {
    warnings.push({
      code: "empty-import",
      message: "No Markdown files were found in the selected vault source."
    });
  }

  return {
    docs,
    images,
    skipped,
    warnings,
    stats: {
      totalEntries: entries.length,
      markdownBytes,
      strippedArchiveRoot: stripped.root
    }
  };
}

type ImageReplacement = {
  id: string;
  filename: string;
  altText?: string | null;
};

function normalizeEmbedTarget(target: string) {
  const withoutAnchor = target.split("#")[0];
  return normalizeVaultPath(withoutAnchor);
}

function resolveEmbedTarget(
  target: string,
  docSourcePath: string,
  assetsByPath: Map<string, ImageReplacement>
) {
  const normalized = normalizeEmbedTarget(target);
  if (!normalized) return null;
  if (assetsByPath.has(normalized)) return assetsByPath.get(normalized) ?? null;

  const docFolder = docSourcePath.split("/").slice(0, -1).join("/");
  const relative = docFolder ? normalizeVaultPath(`${docFolder}/${normalized}`) : normalized;
  if (relative && assetsByPath.has(relative)) return assetsByPath.get(relative) ?? null;

  const basename = normalized.split("/").pop()?.toLowerCase();
  if (!basename) return null;
  const basenameMatches = Array.from(assetsByPath.entries()).filter(
    ([path]) => path.split("/").pop()?.toLowerCase() === basename
  );
  return basenameMatches.length === 1 ? basenameMatches[0][1] : null;
}

export function rewriteObsidianImageEmbeds(
  body: string,
  docSourcePath: string,
  assetsByPath: Map<string, ImageReplacement>
) {
  if (assetsByPath.size === 0) return body;
  return body.replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, target, caption) => {
    if (!isSupportedImagePath(String(target))) return match;
    const asset = resolveEmbedTarget(String(target), docSourcePath, assetsByPath);
    if (!asset) return match;
    const label = String(caption ?? asset.altText ?? asset.filename).trim();
    return label ? `![[asset:${asset.id}|${label}]]` : `![[asset:${asset.id}]]`;
  });
}
