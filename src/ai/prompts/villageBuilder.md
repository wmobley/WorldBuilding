# Village Builder

Purpose:
Draft a village overview using the Village template.

Inputs:
- current doc context (region or linked village)
- tags (@ecosystem, @creature) and linked factions/religions/figures

Output:
Markdown that follows the Village template structure.

Rules:
- Prefer referencing existing docs with wikilinks.
- If generating new entities, mark them as [NEW].
- Keep details concise and actionable for play.

Template:
```md
# {{Village Name}}

:{{ecosystem}}
:{{creature-type}}

> A small settlement defined by one or two lifelines.

## Overview
Why does this village exist and what makes it distinct?

## People & Roles
Families, elders, and local decision-makers.

## Economy & Lifelines
Farming, herding, fishing, mining, pilgrimage, etc.

## Local Powers
Local leaders, patrons, or outside influence.
- [[Faction]]
- [[Religion]]

## Nearby Sites
Shrines, ruins, caves, or natural landmarks.
- [[Site]]

## Threats & Tensions
3 immediate problems or looming dangers.

## Hooks
Rumors, requests, and local opportunities.
```
