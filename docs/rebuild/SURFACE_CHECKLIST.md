# Surface checklist

Every rendered control, its action, and the spec that proves it. A surface may not ship
controls that are absent from this list. (Replaces the legacy callback audit.)

## Shell (M0)

| Control | Action | Spec |
| --- | --- | --- |
| Theme toggle (topbar) | Switches parchment-light ↔ midnight-ink, persists | `00-boot.spec.ts` |
| Left rail: Home | Routes to Home | `00-boot.spec.ts` |
| Bottom nav (mobile): Home | Routes to Home | `00-boot.spec.ts` (mobile project) |
