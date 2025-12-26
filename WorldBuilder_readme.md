# Worldbuilder — Design & Worldbuilding Philosophy

## What This Is

**Worldbuilder** is a campaign and setting design tool for tabletop RPGs, built around the idea that **worlds are systems**, not lists.

It is inspired by:
- fantasy grimoires and spellbooks  
- cartographers’ atlases and marginal notes  
- Obsidian-style linked knowledge bases  
- the real needs of Dungeon Masters during prep and play  

This project intentionally avoids:
- generic SaaS dashboards  
- rigid “rules-first” structures  
- hard-coded assumptions about a single setting or system  

---

## What It Includes Now

- **Worldview + Timeline** to keep high-level forces and events connected.
- **Maps** for regional or local uploads with pins linked to pages.
- **Bestiary** with stat blocks from 5e.tools data and SRD seeds.
- **NPCs** that can be based on a creature stat block without embedding it in markdown.
- **DM tools** (DM Screen, Encounter Generator, Loot Generator, CR Calculator).
- **Settings** for imports/exports and theme switching.

---

## Core Worldbuilding Principles

### 1. Systems Before Details
Worlds are shaped by **forces**, **beliefs**, and **history** before they are shaped by individual NPCs or locations.

The vault encourages authors to start with:
- factions
- religions
- magic and cosmology
- history and ages

Specific people, places, and events then *emerge* from these systems.

---

### 2. Pages Are Pages, Not Records
Each document is treated like a **page in a tome**, not a database record.

- Markdown is the source of truth
- Links are written naturally using `[[WikiLinks]]`
- Backlinks act as “marginalia,” revealing hidden connections

This keeps the experience literary and exploratory, not administrative.

---

### 3. Wikilinks Are the Spine of the World
Links are first-class citizens.

```md
The Iron Concord enforces order along the [[Sapphire Coast]]  
and opposes the influence of [[The Veiled Star]].
```

From this:
- relationships emerge automatically
- hierarchy is optional
- meaning is created by edges, not folders

---

### 4. Tags Represent Context, Not Content
Some concepts should not be folders or pages — they are **contextual properties**.

This project treats **creatures** and **ecosystems** as tags, not primary documents.

Examples:
```md
#ecosystem:coastal
#ecosystem:forest
#creature:undead
#creature:beasts
```

Tags allow the same information to be used for:
- encounter prep
- travel logic
- random generation
- session notes

Without duplicating content.

---

### 5. Locations Are Scales, Not Buckets
Locations are intentionally **scale-agnostic**.

A location page may represent:
- a continent
- a region
- a city
- a district
- a ruin
- a single landmark

The vault does **not** enforce a location hierarchy.

Instead:
- **edges (wikilinks)** explain how places relate
- **backlinks** reveal context and influence
- **tags** describe environmental assumptions

Example:
```md
[[The Sapphire Coast]] contains the port city of [[Aurelian]]  
[[Aurelian]] is dominated by the influence of [[The Iron Concord]]
```

Scale is inferred through connections, not folder depth.

---

### 6. Places Are Shaped by What Acts There
A place is defined by:
- who controls it
- what believes in it
- what survives there
- what has happened there

Location pages naturally link to:
- factions
- religions
- notable figures
- historical events
- creature and ecosystem tags

This makes locations **context-aware** during play and prep.

---

## Initial World Structure (Default Vault Seed)

On first run, Worldbuilder seeds a **system-first spellbook**, not a setting-specific one.

### 📁 World
- **Welcome**  
  Explains the philosophy of the vault and how links and tags work.

- **Factions**  
  Political, economic, military, or ideological powers.

- **Religions**  
  Belief systems, cults, pantheons, heresies.

- **Magic & Cosmology**  
  The rules of reality, sources of power, planes, metaphysics.

- **History & Ages**  
  Time as structure: eras, collapses, turning points.

---

### 📁 Places
- **Regions**  
  High-level geographic or political domains.

Individual places may represent any scale and are connected by links rather than hierarchy.

---

### 📁 People
- **Notable Figures**  
  Leaders, villains, heroes, and myths-in-the-flesh.

People are always contextualized by:
- factions
- regions
- belief systems

---

### 📁 Lore
- **Myths & Legends**  
  Folklore, symbolic stories, unreliable truths.

---

## Why This Matters for Play

This structure supports:
- faster DM prep
- meaningful randomization
- consistent world logic
- player-facing knowledge boundaries

Examples:
- “What creatures make sense *here*?”
- “Who would oppose the party *right now*?”
- “What does this faction want *in this region*?”

Later features (AI, generators, session tools) build on this foundation — they do not replace it.

---

## Design Philosophy (UI)

The interface is intentionally styled as:
- a **grimoire**, not a dashboard
- pages, margins, and chapters
- ink, parchment, candlelight

---

## Data & Imports

- **Local-first storage:** all data lives in the browser (IndexedDB).
- **Imports:** Foundry JSON/DB, 5e.tools JSON, and zip bundles are supported.
- **Exports:** Foundry- and Roll20-friendly JSON exports are available in Settings.

---

## Bestiary & References

- Reference pages use **table views** with expandable detail rows.
- The Bestiary renders a full stat block per creature (Aided-style table + details).
- SRD monsters are seeded from bundled JSON, and 5e.tools imports add to it.

---

## NPCs & Stat Blocks

NPCs are normal pages, but can be linked to a base creature:
- Choose a creature on NPC creation.
- Change the creature later (stat block updates without editing markdown).

Light and dark themes represent:
- **Daylight Study** — clarity, parchment, ink
- **Candlelit Study** — focus, charcoal, ember

The UI should feel like a book you return to, not a tool you escape from.

---

## Non-Goals (By Design)

- This is **not** a rules engine
- This is **not** a character builder
- This is **not** a generic note-taking app
- This is **not** a replacement for imagination

It is a **world engine** — a place where ideas connect, persist, and evolve.

---

## How This README Is Used

This document is:
- referenced in Codex prompts
- the guiding philosophy for contributors
- the explanation for why features are shaped the way they are

When in doubt:
> *Does this help a world emerge naturally?*

If yes — it belongs here.
