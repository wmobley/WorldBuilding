import data from "../data/srd/reference-data.json";
import bestiary from "../data/srd/bestiary.json";
import toolRefs from "../data/5etools/reference-seed.json";
import { supabase } from "../lib/supabase";
import { createId } from "../lib/id";
import { getSetting, setSetting } from "./queries";

export async function seedReferencesIfNeeded() {
  const seeded = await getSetting("referencesSeeded");
  if (seeded === "true") {
    const existing = await countReferences();
    if (existing > 0) {
      await seedBestiaryIfNeeded();
      return;
    }
  }

  const existing = await countReferences();
  if (existing > 0) {
    await setSetting("referencesSeeded", "true");
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
    const { error } = await supabase.from("references").insert(
      entries.map((entry) => ({
        id: entry.id,
        slug: entry.slug,
        name: entry.name,
        source: entry.source,
        content: entry.content
      }))
    );
    if (error) {
      console.error("Supabase error in seedReferencesIfNeeded:", error);
    }
  }
  await setSetting("referencesSeeded", "true");

  await seedBestiaryIfNeeded();
  await seedToolReferencesIfNeeded();
}

async function seedBestiaryIfNeeded() {
  const seeded = await getSetting("bestiarySeeded");
  if (seeded === "true") {
    const existing = await countReferencesBySlug("bestiary");
    if (existing > 0) return;
  }

  const monsters = bestiary.monsters ?? [];
  if (monsters.length === 0) {
    await setSetting("bestiarySeeded", "true");
    return;
  }

  const existingEntries = await listReferencesBySlug("bestiary");
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
    const { error } = await supabase.from("references").insert(
      toAdd.map((entry) => ({
        id: entry.id,
        slug: entry.slug,
        name: entry.name,
        source: entry.source,
        content: entry.content,
        raw_json: entry.rawJson
      }))
    );
    if (error) {
      console.error("Supabase error in seedBestiaryIfNeeded:add:", error);
    }
  }
  if (toUpdate.length > 0) {
    await Promise.all(
      toUpdate.map((entry) => {
        const existing = existingMap.get(buildKey(entry.name, entry.source));
        if (!existing) return Promise.resolve();
        return supabase
          .from("references")
          .update({
            raw_json: entry.rawJson,
            source: existing.source || entry.source
          })
          .eq("id", existing.id);
      })
    );
  }
  await setSetting("bestiarySeeded", "true");
}

async function seedToolReferencesIfNeeded() {
  const seeded = await getSetting("toolReferencesSeeded");
  const references =
    (toolRefs.references ?? {}) as Record<
      string,
      Array<{ name?: string; source?: string; rawJson?: string }>
    >;
  const slugs = Object.keys(references);
  if (seeded === "true") {
    const existing = await countReferencesBySlugs(slugs);
    if (existing > 0) return;
  }

  for (const slug of slugs) {
    const items = references[slug] ?? [];
    if (!Array.isArray(items) || items.length === 0) continue;
    const existingEntries = await listReferencesBySlug(slug);
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
      const { error } = await supabase.from("references").insert(
        toAdd.map((entry) => ({
          id: entry.id,
          slug: entry.slug,
          name: entry.name,
          source: entry.source,
          content: entry.content,
          raw_json: entry.rawJson
        }))
      );
      if (error) {
        console.error("Supabase error in seedToolReferencesIfNeeded:add:", error);
      }
    }
    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map((entry) => {
          const existing = existingMap.get(`${entry.name}::${entry.source}`.toLowerCase());
          if (!existing) return Promise.resolve();
          return supabase
            .from("references")
            .update({ raw_json: entry.rawJson })
            .eq("id", existing.id);
        })
      );
    }
  }

  await setSetting("toolReferencesSeeded", "true");
}

async function countReferences() {
  const { count, error } = await supabase
    .from("references")
    .select("id", { count: "exact", head: true });
  if (error) {
    console.error("Supabase error in countReferences:", error);
    return 0;
  }
  return count ?? 0;
}

async function countReferencesBySlug(slug: string) {
  const { count, error } = await supabase
    .from("references")
    .select("id", { count: "exact", head: true })
    .eq("slug", slug);
  if (error) {
    console.error("Supabase error in countReferencesBySlug:", error);
    return 0;
  }
  return count ?? 0;
}

async function countReferencesBySlugs(slugs: string[]) {
  if (slugs.length === 0) return 0;
  const { count, error } = await supabase
    .from("references")
    .select("id", { count: "exact", head: true })
    .in("slug", slugs);
  if (error) {
    console.error("Supabase error in countReferencesBySlugs:", error);
    return 0;
  }
  return count ?? 0;
}

async function listReferencesBySlug(slug: string) {
  const { data, error } = await supabase
    .from("references")
    .select("*")
    .eq("slug", slug);
  if (error) {
    console.error("Supabase error in listReferencesBySlug:", error);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    source: row.source,
    content: row.content,
    rawJson: row.raw_json ?? undefined
  }));
}
