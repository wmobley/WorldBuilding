# Priority 4: Non-AI Prep Helpers

## Goal
Provide deterministic prep tools using existing data.

## Current State
- Tags and links exist
- No structured helpers

## Helpers To Build
- Suggest Encounter
- Who’s Involved
- What Changed Recently

## Output
- Structured JSON
- Explainable logic
  - `explain`: ordered steps with details
  - `inputsUsed`: tags/ids used for determinism
  - `warnings`: missing data or fallbacks

## Tag Conventions
Helpers read namespaced tags. For encounter matching:
- `creature_type:*`
- `terrain:*`
- `travel:*`
- `cr:*`

These tags should be lowercase kebab-case values (see vocabulary registry).

## Example Outputs

### Suggest Encounter
```json
{
  "logic": {
    "creatureTypeTags": [],
    "terrainTags": ["forest"],
    "travelTags": [],
    "crTags": ["0-1"],
    "crBuckets": ["cr:0-1"],
    "matchRules": [
      "Terrain or travel tags select the encounter table.",
      "CR tags filter encounter buckets; otherwise party level provides defaults.",
      "Creature-type tags narrow entries by text or monster suggestions.",
      "Roll d100 for each suggestion with filtered fallback."
    ],
    "selection": "terrain:forest",
    "limit": 6
  },
  "explain": [
    { "step": "table", "detail": "Selected Forest Encounters from terrain:forest." },
    { "step": "filter", "detail": "Filtered to 1 CR bucket(s) and 0 creature-type tag(s)." },
    { "step": "roll", "detail": "Rolled d100 for 1 encounter(s)." }
  ],
  "inputsUsed": {
    "tags": {
      "creatureTypeTags": [],
      "terrainTags": ["forest"],
      "travelTags": [],
      "crTags": ["0-1"]
    },
    "party": {
      "size": 4,
      "level": 3,
      "difficulty": "medium"
    },
    "table": {
      "id": "forest_encounters_d100",
      "title": "Forest Encounters",
      "selectors": {
        "type": "table",
        "terrain": "forest",
        "encounter_type": "combat",
        "source": "homebrew"
      }
    }
  },
  "encounterPlan": {
    "budget": 300,
    "rolls": [2],
    "crBuckets": ["cr:0-1"]
  },
  "warnings": [],
  "results": [
    {
      "id": "forest_encounters_d100:2:Wolf pack stalking the party:1-3",
      "tableId": "forest_encounters_d100",
      "tableTitle": "Forest Encounters",
      "roll": 2,
      "range": [1, 3],
      "text": "Wolf pack stalking the party",
      "encounterType": "combat",
      "crBucket": "cr:0-1",
      "monsterSuggestions": [
        { "name": "Wolf", "count": "2d6", "source": "srd", "notes": "" }
      ],
      "needsHomebrew": false,
      "match": {
        "creatureTypeTags": [],
        "terrainTags": ["forest"],
        "travelTags": [],
        "crBuckets": ["cr:0-1"]
      }
    }
  ]
}
```

### Who's Involved
```json
{
  "logic": {
    "sources": ["linkedDocs", "backlinks"],
    "includedTypes": ["Faction", "Religion", "Figure"],
    "limit": 10
  },
  "explain": [
    { "step": "filter", "detail": "Included linked docs (2) and backlinks (1)." },
    { "step": "classify", "detail": "Included types: Faction, Religion, Figure." }
  ],
  "inputsUsed": {
    "linkedDocIds": ["doc-2", "doc-3"],
    "backlinkDocIds": ["doc-4"],
    "includedTypes": ["Faction", "Religion", "Figure"]
  },
  "warnings": [],
  "results": [
    { "id": "doc-2", "title": "Arcane Circle", "type": "Faction", "sources": ["linked"] },
    { "id": "doc-3", "title": "Hidden Tide", "type": "Figure", "sources": ["linked"] },
    { "id": "doc-4", "title": "Sun Choir", "type": "Religion", "sources": ["backlink"] }
  ]
}
```

### What Changed Recently
```json
{
  "logic": {
    "sources": ["recentlyUpdatedDocs", "linkedDocs", "backlinks"],
    "limit": 8,
    "ordering": "updatedAt desc, related docs first"
  },
  "explain": [
    { "step": "collect", "detail": "Collected 4 recently updated docs." },
    { "step": "order", "detail": "Prioritized related docs and sorted by recency." }
  ],
  "inputsUsed": {
    "currentDocId": "doc-1",
    "linkedDocIds": ["doc-2"],
    "backlinkDocIds": ["doc-3"],
    "recentDocIds": ["doc-1", "doc-2", "doc-3", "doc-4"]
  },
  "warnings": [],
  "results": [
    { "id": "doc-1", "title": "Harbor", "updatedAt": "2025-01-05T12:00:00.000Z", "reason": "currentDoc" },
    { "id": "doc-2", "title": "Arcane Circle", "updatedAt": "2025-01-05T11:58:00.000Z", "reason": "linked" },
    { "id": "doc-3", "title": "Sun Choir", "updatedAt": "2025-01-05T11:57:00.000Z", "reason": "backlink" },
    { "id": "doc-4", "title": "Ledger", "updatedAt": "2025-01-05T11:56:00.000Z", "reason": "recentCampaignUpdate" }
  ]
}
```

## Success Criteria
- Helpful without AI
- Predictable output
