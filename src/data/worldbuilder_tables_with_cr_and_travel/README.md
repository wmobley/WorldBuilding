# WorldBuilder Tables Pack (d100 + CR Buckets + Monster Mappings)

This pack contains deterministic tables intended for WorldBuilder ingestion.

## File Types
- `*.md` : human-friendly table notes (tagged)
- `*.table.json` : structured table payloads for fast ingestion and validation

## JSON Schema (worldbuilder.table.v1)
Each JSON includes:
- `selectors`: key-value tags used for indexing (terrain/travel/encounter_type/source)
- `entries[]`:
  - `range`: [min,max] inclusive
  - `text`: encounter label
  - `cr_bucket`: one of `cr:0-1 | cr:2-4 | cr:5-10 | cr:11-16 | cr:17-20 | cr:21+`
  - `monster_suggestions`: optional list with {name,count,source,notes}
  - `needs_homebrew`: boolean when SRD status is uncertain or requires campaign content

## Suggested Ingestion
1) Parse tags from markdown for display/search
2) Prefer `.table.json` for deterministic helper selection
3) When `needs_homebrew=true`, present an inline warning and allow DM override/mapping
