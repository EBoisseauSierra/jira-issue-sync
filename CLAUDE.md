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
npx jest src/__tests__/orchestrators/issue-opened.test.ts
```

## Architecture (N-Tier)

This is a TypeScript GitHub Action bundled with `@vercel/ncc` into `dist/index.js`. GitHub runs that file directly — no install step at runtime.

The codebase follows an n-tier architecture:

**Controller** — processes external inputs and dispatches to the appropriate orchestrator:
- `src/index.ts` — reads the GitHub webhook event action (`opened`/`closed`), validates the payload, and delegates to the matching orchestrator. Also calls `run().catch(...)` at the top level so unhandled rejections surface as workflow failures.
- `src/inputs.ts` — reads and validates all GitHub Actions inputs into a typed `ActionInputs` object.

**Orchestrators** — coordinate multiple services to fulfil a use case:
- `src/orchestrators/issue-opened.ts` — calls the Jira repository to create a task, then the GitHub repository to post a link comment.
- `src/orchestrators/issue-closed.ts` — calls the GitHub repository to fetch comments, extracts the Jira issue key, then calls the Jira repository to transition the task to Done.

**Repositories** — implement the interface with external systems (Jira REST API, GitHub REST API):
- `src/repositories/jira-repository.ts` — `createJiraRepository()` returns `{ createTask, transitionToDone }`. Handles auth headers, Atlassian Document Format, and wraps Axios errors with HTTP status + response body.
- `src/repositories/github-repository.ts` — `createGitHubRepository()` returns `{ postComment, fetchComments }`. Wraps Octokit and normalises null comment bodies.

Tests mirror the source tree under `src/__tests__/`. Repository layers are mocked with `jest.mock` so orchestrators and controllers are tested in isolation.

## Key Design Decisions

- **`dist/` is committed** — required for GitHub Actions Marketplace distribution. Do not add it to `.gitignore`.
- **Jira link stored as GitHub comment** — pattern: `Jira task created: [PROJ-123](url)`. The issue-closed orchestrator reads this back to find the issue key.
- **Epic linked via `parent` field** — works for next-gen (team-managed) Jira projects only. Classic projects need `customfield_10014`.
- **Hardcoded `Task` issue type and `Done` transition name** — MVP constraint, both will be configurable later.
- **`transitionToDone` looks up the transition ID at runtime** — avoids hardcoding numeric IDs that differ between Jira instances.
- **Error wrapping in jira-repository** — Axios errors include HTTP status + response body for debuggability.

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
