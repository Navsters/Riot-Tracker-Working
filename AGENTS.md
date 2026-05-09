# AGENTS.md

## Cursor Cloud specific instructions

This is a frontend-only React + Vite + TypeScript SPA ("Valorant Habit Observatory"). There is no backend, database, or external API — all match data is generated client-side via a seeded PRNG.

### Key commands

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` (Vite, port 5173) |
| Lint | `npm run lint` |
| Build | `npm run build` (tsc + vite build) |
| Preview prod build | `npm run preview` |

### Notes

- There are no automated tests configured (no test runner or test scripts in `package.json`).
- `npm run lint` has a pre-existing `prefer-const` error in `src/analytics/computeHabitAnalytics.ts`.
- The app generates mock data deterministically from a Riot ID input — no real API calls are made.
- To expose the dev server on all interfaces (useful in Cloud Agent VMs), run `npm run dev -- --host 0.0.0.0`.
