# Priority 2: Supabase Sync & Authentication

## Goal
Enable optional cloud sync while preserving local-first behavior.

## Current State
- Supabase client exists
- Environment config present

## Missing
- Full auth flow
- Vault sync logic
- Conflict handling

## Tasks
- Implement login/logout
- Define vault schema
- Sync local ↔ remote
- Handle offline cases

## Success Criteria
- Data persists across devices
- Local-first behavior preserved
