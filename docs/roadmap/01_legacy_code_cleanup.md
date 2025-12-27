# Priority 1: Legacy / 5e.tools Code Cleanup

## Goal
Reduce technical debt introduced from inherited or copied 5e.tools code and align all logic with the Worldbuilder architecture.

## Current State
- Some legacy utilities and data structures remain
- Some files are unused or partially integrated

## What Works
- Core app runs correctly
- Legacy code does not block execution

## Work To Do
- Identify unused or duplicate files
- Remove or refactor legacy utilities
- Move shared logic into /lib
- Ensure no dead imports remain

## Success Criteria
- No unused code
- Clear ownership of all modules
