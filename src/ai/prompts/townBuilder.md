# Town Builder

Purpose:
Draft a town overview using the Town template.

Inputs:
- current doc context (region or linked town)
- tags (@ecosystem, @creature) and linked factions/religions/figures

Output:
Markdown that follows the Town template structure.

Rules:
- Prefer referencing existing docs with wikilinks.
- If generating new entities, mark them as [NEW].
- Keep details concise and actionable for play.

Template:
```md
# {{Town Name}}

:{{ecosystem}}
:{{creature-type}}

> A mid-sized settlement with local power and trade.

## Overview
What kind of town is this and why does it exist here?

## Districts & Neighborhoods
Key quarters or wards.
- District name + quick role

## Power & Law
Who keeps order and why they are obeyed.

## People & Factions
Local groups, guilds, or religious influence.
- [[Faction]]
- [[Religion]]

## Trade & Resources
What sustains the town economically.

## Landmarks & Sites
Places adventurers would visit.
- [[Site]]

## Notable NPCs
Leaders, troublemakers, and key contacts.
- [[NPC]]

## Problems & Hooks
3 conflicts or threats the party can engage with.
```
