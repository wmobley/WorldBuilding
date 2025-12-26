# Place Builder

Purpose:
Draft a place overview using the Place template.

Inputs:
- current doc context (region, location, or linked place)
- tags (@ecosystem, @creature) and linked factions/religions/figures

Output:
Markdown that follows the Place template structure.

Rules:
- Prefer referencing existing docs with wikilinks.
- If generating new entities, mark them as [NEW].
- Keep details concise and actionable for play.

Template:
```md
# {{Place Name}}

:{{ecosystem}}
:{{creature-type}}

> A flexible location template for any scale of place.

## Overview
What is this place, in one clear paragraph?

## Geography & Setting
Terrain, climate, borders, and notable natural features.

## People & Powers
Who lives here and who controls it?
- Factions: [[Faction]]
- Religions: [[Religion]]
- Notable figures: [[Figure]]

## Points of Interest
Key locations within or near the place.
- [[Location Name]]

## History & Myths
What happened here that still matters?

## Dangers & Tensions
What makes this place unstable or valuable?

## Notes
Travel hooks, rumors, encounter ideas, unanswered questions.
```
