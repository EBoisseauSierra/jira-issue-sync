# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test                  # Run all Jest tests
npm run test:coverage     # Run tests with coverage report
npm run lint              # ESLint on src/**/*.ts
npm run typecheck         # tsc --noEmit (no compilation output)
npm run build             # Bundle with ncc → dist/index.js
npm run format            # Prettier on src/**/*.ts

# Run a single test file
npx jest src/__tests__/inputs.test.ts
npx jest src/__tests__/handlers/opened.test.ts
```

## Architecture

This is a TypeScript GitHub Action bundled with `@vercel/ncc` into `dist/index.js`. GitHub runs that file directly — no install step at runtime.

Entry point: `src/index.ts` exports `run()`, which reads the GitHub event action (`opened` or `closed`) and dispatches to the appropriate handler. The file also calls `run().catch(...)` at the top level so unhandled rejections surface as workflow failures.

```
src/index.ts              — dispatcher (reads event action, calls handler)
src/inputs.ts             — reads all action inputs via @actions/core
src/github-client.ts      — thin wrapper: postComment, fetchComments
src/jira-client.ts        — thin wrapper: createTask, transitionToDone
src/handlers/opened.ts    — create Jira task → post GitHub comment
src/handlers/closed.ts    — find Jira link in comments → transition to Done
```

Tests mirror the source tree under `src/__tests__/`. HTTP layers are mocked with `jest.mock`.

## Key Design Decisions

- **`dist/` is committed** — required for GitHub Actions Marketplace distribution. Do not add it to `.gitignore`.
- **Jira link stored as GitHub comment** — pattern: `Jira task created: [PROJ-123](url)`. The closed handler reads this back to find the issue key.
- **Epic linked via `parent` field** — works for next-gen (team-managed) Jira projects only. Classic projects need `customfield_10014`.
- **Hardcoded `Task` issue type and `Done` transition name** — MVP constraint, both will be configurable later.
- **`transitionToDone` looks up the transition ID at runtime** — avoids hardcoding numeric IDs that differ between Jira instances.
- **Error wrapping in jira-client** — Axios errors include HTTP status + response body for debuggability.

## Commit Conventions

Conventional Commits format, enforced by commitlint + Husky:

```
<type>(<scope>): <short description>

<body explaining what and why>
```

Use plain `git commit -m "..."` — no GPG flags.

## Pre-commit Hooks

Husky v9 runs on every commit:
- `pre-commit`: lint-staged (eslint + prettier on staged `.ts` files) + `tsc --noEmit`
- `commit-msg`: commitlint (Conventional Commits)

Hook files must be executable (mode 100755). If hooks silently stop running, check with `git ls-files -s .husky/`.
