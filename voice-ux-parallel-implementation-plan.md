# BetterCord Voice UX Parallel Implementation Plan

## Objective
Close the highest-impact UX gaps fast with parallel implementation streams, minimal merge conflicts, and clear acceptance criteria.

## Delivery Strategy
- Use 3 parallel streams for P0/P1 core fixes.
- Keep strict file ownership per stream during Wave 1.
- Merge Wave 1 first, then run Wave 2 parity improvements.
- Run a final integration QA gate before final rollout.

## Wave 1 (Parallel)

### Stream A - Mobile Navigation Reliability (P0)
Owner: Sub-agent A

Scope:
- Ensure mobile drawer has a clear open/close trigger.
- Fix bottom-nav active states on nested routes.
- Keep behavior consistent across Home, Direct, Inbox, Explore, and Space routes.

Owned files:
- `src/app/components/mobile-bottom-nav/MobileBottomNav.tsx`
- `src/app/components/mobile-bottom-nav/MobileBottomNav.css.ts`
- `src/app/components/mobile-drawer/SidebarDrawerWrapper.tsx`
- `src/app/components/mobile-drawer/MobileDrawerContext.tsx`
- `src/app/pages/Router.tsx`

Acceptance criteria:
- Drawer can be opened and closed from mobile core screens.
- Bottom tab remains correctly highlighted on nested pages.
- No layout overlap with bottom nav and drawer overlay.

### Stream B - Call Interaction Safety (P0)
Owner: Sub-agent B

Scope:
- Fix incoming-call card overlap (stacking/offset/z-order).
- Separate Ignore vs Reject semantics.
- Improve call HUD control reachability for touch/keyboard contexts.

Owned files:
- `src/app/features/room-nav/RoomCallNavStatus.tsx`
- `src/app/features/room-nav/RoomCallNavStatusIncoming.tsx`
- `src/app/features/room-nav/RoomCallNavStatus.css.ts`
- `src/app/pages/client/call/NativeCallView.tsx`
- `src/app/pages/client/call/NativeCallView.module.css`
- `src/app/pages/client/call/NativeCallControlBar.module.css`

Acceptance criteria:
- Multiple incoming calls are independently visible and clickable.
- Ignore does not behave like a hard reject/hangup suppression.
- Core controls (mute/video/hangup) remain reliably reachable in call.

### Stream C - Unified Voice Badge System (P1)
Owner: Sub-agent C

Scope:
- Standardize LIVE/mute/camera/deafen badge semantics across call surfaces.
- Improve badge readability and accessibility labels.
- Keep state mapping consistent for local and remote participants.

Owned files:
- `src/app/features/room-nav/RoomNavUser.tsx`
- `src/app/features/room-nav/RoomNavUser.module.css`
- `src/app/pages/client/call/NativeCallParticipantTile.tsx`
- `src/app/pages/client/call/NativeCallParticipantTile.module.css`
- Optional shared mapping helper: `src/app/features/call/presenceBadges.ts`

Acceptance criteria:
- Same status meaning and visual language in room list and call tiles.
- Clear labels/tooltips for badge meaning.
- No contradictory state representation between views.

## Wave 2 (After Wave 1 Merge)

### Stream D - Fluxer Parity Stream UX (P1/P2)
Owner: Sub-agent D

Scope:
- Improve watch-flow states (watching, ended, unavailable, reconnecting).
- Add stronger spectator context and preview polish.
- Refine stream-focused interaction model.

Target files:
- `src/app/pages/client/call/NativeCallParticipantGrid.tsx`
- `src/app/pages/client/call/NativeCallParticipantTile.tsx`
- `src/app/pages/client/call/NativeCallView.tsx`

Acceptance criteria:
- Stream interaction states are explicit and resilient.
- Users can understand watch state at a glance.

## Integration and QA Gate

Validation checklist:
- Mobile drawer open/close from all key routes.
- Bottom-nav active states across nested routes.
- Incoming call stacking with 2-3 simultaneous calls.
- Ignore vs Reject behavior matches labels.
- In-call controls reachable via pointer/touch/keyboard.
- Badge consistency across room list, side panel, and call tiles.
- Build succeeds.

Commands:
- `yarn typecheck`
- `yarn build`

## Merge Policy
- Wave 1 streams merge in order of least conflict: A -> C -> B.
- Run quick smoke test after each merge.
- Wave 2 starts only after Wave 1 QA pass.

## Notes
- Follow `AGENTS.md` constraints for all call/voice files.
- Keep files at or below 650 lines; split if needed.
- Prefer minimal-risk UX fixes first, then parity enhancements.
