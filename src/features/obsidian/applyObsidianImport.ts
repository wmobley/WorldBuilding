import { createId } from "../../lib/id";
import {
  hashText,
  rewriteObsidianImageEmbeds,
  type ObsidianImportPreview
} from "../../lib/obsidianImport";
import type { Asset, Doc, Folder, VaultSource, VaultSourceFile } from "../../vault/types";
import {
  createDoc,
  createFolder,
  getAssetById,
  getDocById,
  listFolders,
  listVaultSourceFiles,
  moveDoc,
  renameDoc,
  replaceAssetFile,
  saveDocContent,
  updateAllFolderIndexes,
  updateVaultSourceFileMissing,
  updateVaultSourceSyncStatus,
  uploadAsset,
  upsertVaultSource,
  upsertVaultSourceFiles
} from "../../vault/queries";

export type ObsidianSourceInput = {
  provider: VaultSource["provider"];
  sourceKey: string;
  displayName: string;
  repoOwner?: string | null;
  repoName?: string | null;
  repoBranch?: string | null;
  rootPath?: string | null;
};

export type ObsidianImportConflict = {
  sourcePath: string;
  docId: string;
  title: string;
  reason: string;
};

export type AppliedObsidianImportResult = {
  source: VaultSource;
  createdDocs: number;
  updatedDocs: number;
  unchangedDocs: number;
  uploadedImages: number;
  replacedImages: number;
  reusedImages: number;
  conflicts: ObsidianImportConflict[];
  missingFiles: number;
};

function folderPathKey(path: string[]) {
  return path.join("/");
}

function buildExistingFolderPathMap(folders: Folder[]) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const pathCache = new Map<string, string>();
  const paths = new Map<string, Folder>();

  const resolvePath = (folder: Folder): string => {
    const cached = pathCache.get(folder.id);
    if (cached !== undefined) return cached;
    const parent = folder.parentFolderId ? byId.get(folder.parentFolderId) : null;
    const parentPath = parent ? resolvePath(parent) : "";
    const path = parentPath ? `${parentPath}/${folder.name}` : folder.name;
    pathCache.set(folder.id, path);
    return path;
  };

  folders.forEach((folder) => {
    paths.set(resolvePath(folder), folder);
  });
  return paths;
}

async function ensureFolders(campaignId: string, folderPaths: string[][]) {
  const existingFolders = await listFolders(campaignId);
  const byPath = buildExistingFolderPathMap(existingFolders);
  const folderIds = new Map<string, string | null>([["", null]]);

  byPath.forEach((folder, path) => {
    folderIds.set(path, folder.id);
  });

  const sortedPaths = Array.from(
    new Set(folderPaths.map(folderPathKey).filter(Boolean))
  ).sort((a, b) => a.split("/").length - b.split("/").length);

  for (const path of sortedPaths) {
    if (folderIds.has(path)) continue;
    const segments = path.split("/");
    let parentPath = "";
    let parentId: string | null = null;
    for (const segment of segments) {
      const nextPath = parentPath ? `${parentPath}/${segment}` : segment;
      if (!folderIds.has(nextPath)) {
        const folder = await createFolder(segment, parentId, campaignId);
        folderIds.set(nextPath, folder.id);
      }
      parentPath = nextPath;
      parentId = folderIds.get(nextPath) ?? null;
    }
  }

  return folderIds;
}

function getExistingMapping(
  filesByPath: Map<string, VaultSourceFile>,
  sourcePath: string
) {
  return filesByPath.get(sourcePath) ?? null;
}

async function currentDocMatchesLastImport(doc: Doc, mapping: VaultSourceFile) {
  return (await hashText(doc.body)) === mapping.contentHash;
}

async function applyImageImports({
  campaignId,
  source,
  preview,
  filesByPath,
  now
}: {
  campaignId: string;
  source: VaultSource;
  preview: ObsidianImportPreview;
  filesByPath: Map<string, VaultSourceFile>;
  now: number;
}) {
  const assetsByPath = new Map<string, Asset>();
  const mappings: VaultSourceFile[] = [];
  let uploadedImages = 0;
  let replacedImages = 0;
  let reusedImages = 0;

  for (const image of preview.images) {
    const existing = getExistingMapping(filesByPath, image.sourcePath);
    let asset = existing?.assetId ? await getAssetById(existing.assetId) : null;

    if (asset && existing?.contentHash === image.contentHash) {
      reusedImages += 1;
    } else if (asset) {
      await replaceAssetFile(asset, image.file);
      asset = await getAssetById(asset.id);
      replacedImages += 1;
    } else {
      asset = await uploadAsset(campaignId, null, image.file, image.filename);
      uploadedImages += 1;
    }

    if (!asset) continue;
    assetsByPath.set(image.sourcePath, asset);
    mappings.push({
      id: existing?.id ?? createId(),
      sourceId: source.id,
      campaignId,
      kind: "image",
      sourcePath: image.sourcePath,
      docId: null,
      assetId: asset.id,
      contentHash: image.contentHash,
      importedTitle: image.filename,
      lastSeenAt: now,
      deletedAt: null,
      conflictAt: null,
      conflictReason: null
    });
  }

  await upsertVaultSourceFiles(mappings);
  return { assetsByPath, uploadedImages, replacedImages, reusedImages };
}

export async function applyObsidianImport({
  campaignId,
  preview,
  sourceInput
}: {
  campaignId: string;
  preview: ObsidianImportPreview;
  sourceInput: ObsidianSourceInput;
}): Promise<AppliedObsidianImportResult> {
  let source: VaultSource | null = null;
  try {
    source = await upsertVaultSource({
      campaignId,
      provider: sourceInput.provider,
      sourceKey: sourceInput.sourceKey,
      displayName: sourceInput.displayName,
      repoOwner: sourceInput.repoOwner,
      repoName: sourceInput.repoName,
      repoBranch: sourceInput.repoBranch,
      rootPath: sourceInput.rootPath,
      lastSyncStatus: "syncing",
      lastSyncMessage: "Importing Obsidian vault..."
    });
    const now = Date.now();
    const existingFiles = await listVaultSourceFiles(source.id);
    const filesByPath = new Map(existingFiles.map((file) => [file.sourcePath, file]));
    const seenPaths = new Set([
      ...preview.docs.map((doc) => doc.sourcePath),
      ...preview.images.map((image) => image.sourcePath)
    ]);

    const imageResult = await applyImageImports({
      campaignId,
      source,
      preview,
      filesByPath,
      now
    });
    const assetReplacements = new Map(
      Array.from(imageResult.assetsByPath.entries()).map(([path, asset]) => [
        path,
        { id: asset.id, filename: asset.filename, altText: asset.altText }
      ])
    );
    const folderIds = await ensureFolders(
      campaignId,
      preview.docs.map((doc) => doc.folderPath)
    );

    const docPlans = await Promise.all(
      preview.docs.map(async (candidate) => {
        const body = rewriteObsidianImageEmbeds(
          candidate.body,
          candidate.sourcePath,
          assetReplacements
        );
        return {
          candidate,
          body,
          contentHash: await hashText(body),
          folderId: folderIds.get(folderPathKey(candidate.folderPath)) ?? null
        };
      })
    );

    const conflicts: ObsidianImportConflict[] = [];
    const docMappings: VaultSourceFile[] = [];
    const docTargets: Array<{
      doc: Doc;
      title: string;
      folderId: string | null;
      body: string;
      contentHash: string;
      sourcePath: string;
      existingBody: string;
      created: boolean;
      mapping: VaultSourceFile | null;
    }> = [];

    for (const plan of docPlans) {
      const existingMapping = getExistingMapping(filesByPath, plan.candidate.sourcePath);
      const mappedDoc = existingMapping?.docId
        ? await getDocById(existingMapping.docId)
        : null;

      if (
        existingMapping &&
        mappedDoc &&
        !(await currentDocMatchesLastImport(mappedDoc, existingMapping)) &&
        mappedDoc.body !== plan.body
      ) {
        conflicts.push({
          sourcePath: plan.candidate.sourcePath,
          docId: mappedDoc.id,
          title: mappedDoc.title,
          reason: "Worldbuilder page changed since the last source import."
        });
        docMappings.push({
          id: existingMapping.id,
          sourceId: source.id,
          campaignId,
          kind: "doc",
          sourcePath: plan.candidate.sourcePath,
          docId: mappedDoc.id,
          assetId: null,
          contentHash: existingMapping.contentHash,
          importedTitle: plan.candidate.title,
          lastSeenAt: now,
          deletedAt: null,
          conflictAt: now,
          conflictReason: "worldbuilder-edited"
        });
        continue;
      }

      const doc =
        mappedDoc ?? (await createDoc(plan.candidate.title, plan.folderId, campaignId));
      docTargets.push({
        doc,
        title: plan.candidate.title,
        folderId: plan.folderId,
        body: plan.body,
        contentHash: plan.contentHash,
        sourcePath: plan.candidate.sourcePath,
        existingBody: doc.body,
        created: !mappedDoc,
        mapping: existingMapping
      });
    }

    for (const target of docTargets) {
      if (target.doc.title !== target.title) {
        await renameDoc(target.doc.id, target.title);
      }
      if (target.doc.folderId !== target.folderId) {
        await moveDoc(target.doc.id, target.folderId);
      }
    }

    let createdDocs = 0;
    let updatedDocs = 0;
    let unchangedDocs = 0;
    for (const target of docTargets) {
      if (target.existingBody !== target.body) {
        await saveDocContent(target.doc.id, target.body);
      }
      if (target.created) {
        createdDocs += 1;
      } else if (
        target.existingBody !== target.body ||
        target.doc.title !== target.title ||
        target.doc.folderId !== target.folderId
      ) {
        updatedDocs += 1;
      } else {
        unchangedDocs += 1;
      }
      docMappings.push({
        id: target.mapping?.id ?? createId(),
        sourceId: source.id,
        campaignId,
        kind: "doc",
        sourcePath: target.sourcePath,
        docId: target.doc.id,
        assetId: null,
        contentHash: target.contentHash,
        importedTitle: target.title,
        lastSeenAt: now,
        deletedAt: null,
        conflictAt: null,
        conflictReason: null
      });
    }

    await upsertVaultSourceFiles(docMappings);

    let missingFiles = 0;
    for (const existing of existingFiles) {
      if (seenPaths.has(existing.sourcePath) || existing.deletedAt) continue;
      missingFiles += 1;
      await updateVaultSourceFileMissing(existing.id, now);
    }

    await updateAllFolderIndexes(campaignId);
    const message = `Created ${createdDocs}, updated ${updatedDocs}, unchanged ${unchangedDocs}, conflicts ${conflicts.length}, images ${imageResult.uploadedImages + imageResult.replacedImages + imageResult.reusedImages}.`;
    await updateVaultSourceSyncStatus(source.id, {
      lastSyncStatus: conflicts.length > 0 ? "conflict" : "complete",
      lastSyncMessage: message
    });

    return {
      source,
      createdDocs,
      updatedDocs,
      unchangedDocs,
      uploadedImages: imageResult.uploadedImages,
      replacedImages: imageResult.replacedImages,
      reusedImages: imageResult.reusedImages,
      conflicts,
      missingFiles
    };
  } catch (error) {
    if (source) {
      const message = error instanceof Error ? error.message : "Obsidian import failed.";
      await updateVaultSourceSyncStatus(source.id, {
        lastSyncStatus: "error",
        lastSyncMessage: message
      });
    }
    throw error;
  }
}
