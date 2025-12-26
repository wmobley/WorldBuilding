import data from "../data/srd/reference-data.json";
import bestiary from "../data/srd/bestiary.json";
import toolRefs from "../data/5etools/reference-seed.json";
import { db } from "./db";
import { createId } from "../lib/id";

export async function seedReferencesIfNeeded() {
  const seeded = await db.settings.get("referencesSeeded");
  if (seeded?.value === "true") {
    const existing = await db.references.count();
    if (existing > 0) {
      await seedBestiaryIfNeeded();
      return;
    }
  }

  await db.transaction("rw", db.references, db.settings, async () => {
    const existing = await db.references.count();
    if (existing > 0) {
      await db.settings.put({ key: "referencesSeeded", value: "true" });
      await seedBestiaryIfNeeded();
      return;
    }

    const entries = Object.entries(data.references).flatMap(([slug, items]) =>
      items.map((item) => ({
        id: createId(),
        slug,
        name: item.name,
        source: item.source,
        content: item.content
      }))
    );

    if (entries.length > 0) {
      await db.references.bulkAdd(entries);
    }
    await db.settings.put({ key: "referencesSeeded", value: "true" });
  });

  await seedBestiaryIfNeeded();
  await seedToolReferencesIfNeeded();
}

async function seedBestiaryIfNeeded() {
  const seeded = await db.settings.get("bestiarySeeded");
  if (seeded?.value === "true") {
    const existing = await db.references.where("slug").equals("bestiary").count();
    if (existing > 0) return;
  }

  const monsters = bestiary.monsters ?? [];
  if (monsters.length === 0) {
    await db.settings.put({ key: "bestiarySeeded", value: "true" });
    return;
  }

  const existingEntries = await db.references.where("slug").equals("bestiary").toArray();
  const buildKey = (name: string, source: string) =>
    `${name.toLowerCase()}::${source.toLowerCase()}`;
  const existingMap = new Map(
    existingEntries.map((entry) =>
      [buildKey(entry.name, entry.source || "srd"), entry]
    )
  );
  const entries = monsters
    .filter((monster) => monster && typeof monster === "object")
    .map((monster) => ({
      id: createId(),
      slug: "bestiary",
      name: String(monster.name ?? "Unknown Creature"),
      source: String(monster.source ?? "SRD"),
      content: "",
      rawJson: JSON.stringify(monster)
    }));

  const toAdd = entries.filter(
    (entry) => !existingMap.has(buildKey(entry.name, entry.source))
  );
  const toUpdate = entries.filter((entry) => {
    const existing = existingMap.get(buildKey(entry.name, entry.source));
    return existing && !existing.rawJson;
  });

  if (toAdd.length > 0) {
    await db.references.bulkAdd(toAdd);
  }
  if (toUpdate.length > 0) {
    await Promise.all(
      toUpdate.map((entry) => {
        const existing = existingMap.get(buildKey(entry.name, entry.source));
        if (!existing) return Promise.resolve();
        return db.references.update(existing.id, {
          rawJson: entry.rawJson,
          source: existing.source || entry.source
        });
      })
    );
  }
  await db.settings.put({ key: "bestiarySeeded", value: "true" });
}

async function seedToolReferencesIfNeeded() {
  const seeded = await db.settings.get("toolReferencesSeeded");
  const references = toolRefs.references ?? {};
  const slugs = Object.keys(references);
  if (seeded?.value === "true") {
    const existing = await db.references.where("slug").anyOf(slugs).count();
    if (existing > 0) return;
  }

  for (const slug of slugs) {
    const items = references[slug] ?? [];
    if (!Array.isArray(items) || items.length === 0) continue;
    const existingEntries = await db.references.where("slug").equals(slug).toArray();
    const existingMap = new Map(
      existingEntries.map((entry) => [`${entry.name}::${entry.source}`.toLowerCase(), entry])
    );
    const entries = items
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: createId(),
        slug,
        name: String(item.name ?? "Unknown Entry"),
        source: String(item.source ?? "5e.tools"),
        content: "",
        rawJson: String(item.rawJson ?? "")
      }));
    const toAdd = entries.filter(
      (entry) => !existingMap.has(`${entry.name}::${entry.source}`.toLowerCase())
    );
    const toUpdate = entries.filter((entry) => {
      const existing = existingMap.get(`${entry.name}::${entry.source}`.toLowerCase());
      if (!existing) return false;
      if (!existing.rawJson) return true;
      return !existing.rawJson.includes("\"__category\"");
    });
    if (toAdd.length > 0) {
      await db.references.bulkAdd(toAdd);
    }
    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map((entry) => {
          const existing = existingMap.get(`${entry.name}::${entry.source}`.toLowerCase());
          if (!existing) return Promise.resolve();
          return db.references.update(existing.id, { rawJson: entry.rawJson });
        })
      );
    }
  }

  await db.settings.put({ key: "toolReferencesSeeded", value: "true" });
}
