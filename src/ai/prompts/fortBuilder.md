# Fort Builder

Purpose:
Draft a fort overview using the Fort template.

Inputs:
- current doc context (region or linked fort)
- tags (@ecosystem, @creature) and linked factions/religions/figures

Output:
Markdown that follows the Fort template structure.

Rules:
- Prefer referencing existing docs with wikilinks.
- If generating new entities, mark them as [NEW].
- Keep details concise and actionable for play.

Template:
```md
# {{Fort Name}}

:{{ecosystem}}
:{{creature-type}}

> A military or watch post with a strategic purpose.

## Purpose & Allegiance
Why the fort exists and who it serves.

## Command & Garrison
Leaders, troop makeup, and morale.

## Defenses & Layout
Walls, gates, weak points, and key areas.

## Supply & Logistics
How the fort is supplied and how long it can hold out.

## Surroundings
What lies within a day’s travel and how it shapes the fort’s mission.

## Conflicts & Threats
Sieges, raids, internal strife, or political pressure.

## Hooks
3 adventure hooks tied to the fort.
```
