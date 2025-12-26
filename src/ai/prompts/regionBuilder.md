# Region Builder

Purpose:
Draft a region overview using the Region template.

Inputs:
- current doc context (region or linked locations)
- tags (@ecosystem, @creature) and linked factions/religions

Output:
Markdown that follows the Region template structure.

Rules:
- Prefer referencing existing docs with wikilinks.
- If generating new entities, mark them as [NEW].
- Keep details concise and actionable for play.

Template:
```md
# {{Region Name}}

:{{ecosystem}}
:{{creature-type}}

> A place shaped by land, history, and the forces that act upon it.

## Overview
A high-level description of the region.
Climate, terrain, and general character.

## Geography & Environment
Natural features and hazards.
- Mountains, rivers, ruins, borders
- Ecosystem notes: forests, coasts, deserts, etc.

## Inhabitants & Cultures
Who lives here?
- Dominant peoples or cultures
- Nomads, settlers, outcasts

## Powers & Influence
Who controls or contests this region?
- Factions: [[Faction]]
- Religious influence: [[Religion]]
- External pressures or invasions

## Settlements & Landmarks
Notable locations within the region.
- Cities, towns, ruins, sites of legend:
  - [[Location Name]]

## History
What has happened here that still matters?
- Wars, disasters, miracles, collapses

## Dangers & Opportunities
What makes this region unstable or valuable?
- Conflicts
- Resources
- Ancient threats
- Strategic importance

## Notes
Travel hooks, rumors, encounter ideas, unanswered questions.
```
