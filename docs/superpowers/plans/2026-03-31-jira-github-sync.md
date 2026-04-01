# Jira Issue Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript GitHub Action that creates a Jira Task when a GitHub issue is opened, and transitions it to Done when the issue is closed.

**Architecture:** The entry point (`index.ts`) reads the GitHub event action (`opened` or `closed`) and delegates to one of two focused handler modules. Each handler uses a thin Jira API client and a thin GitHub API client — both are straightforward wrappers that have one responsibility each. The entire Action is compiled into a single `dist/index.js` file using `ncc` so users do not need Node.js installed.

**Tech Stack:** TypeScript 5, Node.js 20, `@actions/core`, `@actions/github`, `axios` (Jira REST API), Jest + ts-jest (unit tests), `@vercel/ncc` (bundler), ESLint + Prettier, Husky + lint-staged + commitlint.

---

## Context for the implementer

**Why `ncc`?** GitHub Actions that use JavaScript must either commit `node_modules/` (large, messy) or use a tool like `ncc` that bundles everything — including all dependencies — into one file (`dist/index.js`). That file is committed and is what GitHub runs.

**Why commit `dist/`?** When a user references `your-handle/jira-issue-sync@v1` in their workflow, GitHub downloads the Action repo at that tag and runs `dist/index.js` directly. There is no install step. If `dist/` is not committed, the Action breaks.

**Why TDD here?** The handlers and API clients are pure functions that take inputs and call HTTP APIs. They are easy to unit-test with mocked HTTP layers. The `index.ts` entry point is a thin dispatcher — it gets its own lightweight test.

**Conventional commits format:**
```
<type>(<scope>): <short description>

<body explaining what and why>
```
Common types: `feat`, `fix`, `chore`, `test`, `docs`, `ci`, `refactor`.
Every commit uses `git commit -Ss` (GPG-signed + Developer Certificate of Origin sign-off).

---

## File Map

| File | Responsibility |
|---|---|
| `action.yml` | Action metadata, input declarations, points to `dist/index.js` |
| `src/inputs.ts` | Reads and validates all GitHub Actions inputs; returns a typed `ActionInputs` object |
| `src/github-client.ts` | Thin wrapper around the GitHub REST API: post a comment, list comments |
| `src/jira-client.ts` | Thin wrapper around the Jira REST API: create a task, transition to Done |
| `src/handlers/opened.ts` | Orchestrates the "issue opened" flow: create Jira task → post GitHub comment |
| `src/handlers/closed.ts` | Orchestrates the "issue closed" flow: find Jira link in comments → transition to Done (or warn) |
| `src/index.ts` | Entry point: reads event action, dispatches to the right handler |
| `src/__tests__/inputs.test.ts` | Unit tests for `inputs.ts` |
| `src/__tests__/github-client.test.ts` | Unit tests for `github-client.ts` |
| `src/__tests__/jira-client.test.ts` | Unit tests for `jira-client.ts` |
| `src/__tests__/handlers/opened.test.ts` | Unit tests for `handlers/opened.ts` |
| `src/__tests__/handlers/closed.test.ts` | Unit tests for `handlers/closed.ts` |
| `src/__tests__/index.test.ts` | Unit tests for `index.ts` dispatch logic |
| `.github/workflows/ci.yml` | Lint + typecheck + test on every push and pull request |
| `.github/workflows/release.yml` | Build `dist/` and create a GitHub Release on `v*` tag push |
| `.husky/pre-commit` | Run lint-staged + typecheck before each commit |
| `.husky/commit-msg` | Enforce conventional commit format |
| `commitlint.config.js` | Configures commitlint to use `@commitlint/config-conventional` |
| `.eslintrc.json` | ESLint rules for TypeScript |
| `.prettierrc` | Prettier formatting config |
| `.gitignore` | Ignore `node_modules/`, build artefacts — NOT `dist/` |
| `README.md` | Usage instructions for Action consumers |

---

## Task 1: Scaffold the project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `jest.config.js`
- Create: `.gitignore`
- Create: `.eslintrc.json`
- Create: `.prettierrc`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "jira-issue-sync",
  "version": "0.1.0",
  "description": "GitHub Action: synchronise GitHub issues with Jira tasks",
  "private": true,
  "main": "dist/index.js",
  "scripts": {
    "build": "ncc build src/index.ts --out dist --source-map --license licenses.txt",
    "test": "jest",
    "test:coverage": "jest --coverage",
    "lint": "eslint 'src/**/*.ts'",
    "format": "prettier --write 'src/**/*.ts'",
    "typecheck": "tsc --noEmit",
    "prepare": "husky install"
  },
  "dependencies": {
    "@actions/core": "^1.10.1",
    "@actions/github": "^6.0.0",
    "axios": "^1.6.8"
  },
  "devDependencies": {
    "@commitlint/cli": "^18.6.1",
    "@commitlint/config-conventional": "^18.6.3",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.11.30",
    "@typescript-eslint/eslint-plugin": "^7.3.1",
    "@typescript-eslint/parser": "^7.3.1",
    "@vercel/ncc": "^0.38.1",
    "eslint": "^8.57.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-prettier": "^5.1.3",
    "husky": "^9.0.11",
    "jest": "^29.7.0",
    "lint-staged": "^15.2.2",
    "prettier": "^3.2.5",
    "ts-jest": "^29.1.2",
    "typescript": "^5.4.2"
  },
  "lint-staged": {
    "src/**/*.ts": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` created. No errors.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create `jest.config.js`**

```js
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  clearMocks: true,
}
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
lib/
*.js.map
coverage/
CHANGELOG_RELEASE.md
licenses.txt
```

Note: `dist/` is intentionally NOT ignored. It must be committed so the Action works without a build step when users reference it.

- [ ] **Step 6: Create `.eslintrc.json`**

```json
{
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-explicit-any": "warn"
  },
  "env": {
    "node": true,
    "jest": true
  }
}
```

- [ ] **Step 7: Create `.prettierrc`**

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 8: Verify lint and typecheck run without errors**

Run: `npm run lint` — Expected: no errors (no source files yet, that's fine)
Run: `npm run typecheck` — Expected: no errors (no source files yet, that's fine)

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json jest.config.js .gitignore .eslintrc.json .prettierrc
git commit -Ss -m "chore(scaffold): initialise Node.js project with TypeScript and Jest

Sets up package.json, tsconfig, jest config, eslint, prettier, and gitignore.
Uses ncc to bundle the Action into a single dist/index.js at release time."
```

---

## Task 2: Set up pre-commit hooks

**Files:**
- Create: `.husky/pre-commit`
- Create: `.husky/commit-msg`
- Create: `commitlint.config.js`

- [ ] **Step 1: Initialise Husky**

Run: `npx husky install`
Expected: `.husky/` directory created with a `_/husky.sh` file inside it.

- [ ] **Step 2: Create the pre-commit hook**

Run:
```bash
npx husky add .husky/pre-commit "npx lint-staged && npx tsc --noEmit"
```
Expected: `.husky/pre-commit` file created with the following content:
```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged && npx tsc --noEmit
```

- [ ] **Step 3: Create the commit-msg hook**

Run:
```bash
npx husky add .husky/commit-msg "npx commitlint --edit \$1"
```
Expected: `.husky/commit-msg` file created with:
```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx commitlint --edit $1
```

- [ ] **Step 4: Create `commitlint.config.js`**

```js
module.exports = {
  extends: ['@commitlint/config-conventional'],
}
```

- [ ] **Step 5: Verify commitlint rejects a bad message**

Run:
```bash
echo "bad commit message" | npx commitlint
```
Expected: exits with a non-zero code and prints an error about the missing type prefix.

- [ ] **Step 6: Commit**

```bash
git add .husky/ commitlint.config.js
git commit -Ss -m "chore(hooks): add Husky pre-commit and commit-msg hooks

Pre-commit runs lint-staged (eslint + prettier on staged .ts files) and
tsc --noEmit. Commit-msg enforces Conventional Commits via commitlint."
```

---

## Task 3: Create `action.yml`

**Files:**
- Create: `action.yml`

- [ ] **Step 1: Create `action.yml`**

```yaml
name: 'Jira Issue Sync'
description: 'Creates a Jira Task when a GitHub issue is opened, and closes it when the issue is closed.'
author: 'your-github-handle'

inputs:
  jira-base-url:
    description: 'Your Atlassian domain, e.g. https://your-org.atlassian.net'
    required: true
  jira-user-email:
    description: 'Email address of the Jira user whose API token is provided'
    required: true
  jira-api-token:
    description: 'Jira API token (store this as a GitHub secret)'
    required: true
  jira-project-key:
    description: 'Key of the Jira project where tasks will be created, e.g. MYPROJECT'
    required: true
  jira-epic-key:
    description: 'Key of the Jira Epic to link new tasks to, e.g. MYPROJECT-42'
    required: true
  github-token:
    description: 'GitHub token used to post comments on issues. Defaults to the built-in GITHUB_TOKEN.'
    required: false
    default: ${{ github.token }}

runs:
  using: 'node20'
  main: 'dist/index.js'

branding:
  icon: 'refresh-cw'
  color: 'blue'
```

- [ ] **Step 2: Commit**

```bash
git add action.yml
git commit -Ss -m "feat(action): add action.yml with input declarations

Declares the five required Jira inputs, an optional github-token input
(defaults to the built-in GITHUB_TOKEN), and points to dist/index.js
as the Node 20 entry point."
```

---

## Task 4: Implement `inputs.ts`

**Files:**
- Create: `src/inputs.ts`
- Create: `src/__tests__/inputs.test.ts`

- [ ] **Step 1: Create the test directory structure**

Run:
```bash
mkdir -p src/__tests__/handlers
```

- [ ] **Step 2: Write the failing test**

Create `src/__tests__/inputs.test.ts`:

```typescript
import * as core from '@actions/core'
import { readActionInputs } from '../inputs'

jest.mock('@actions/core')

const mockGetInput = core.getInput as jest.MockedFunction<typeof core.getInput>

describe('readActionInputs', () => {
  beforeEach(() => {
    mockGetInput.mockImplementation((name: string) => {
      const inputValues: Record<string, string> = {
        'jira-base-url': 'https://test.atlassian.net',
        'jira-user-email': 'test@example.com',
        'jira-api-token': 'test-api-token',
        'jira-project-key': 'TEST',
        'jira-epic-key': 'TEST-1',
        'github-token': 'github-test-token',
      }
      return inputValues[name] ?? ''
    })
  })

  it('reads all inputs and returns a typed ActionInputs object', () => {
    const inputs = readActionInputs()

    expect(inputs).toEqual({
      jiraBaseUrl: 'https://test.atlassian.net',
      jiraUserEmail: 'test@example.com',
      jiraApiToken: 'test-api-token',
      jiraProjectKey: 'TEST',
      jiraEpicKey: 'TEST-1',
      githubToken: 'github-test-token',
    })
  })

  it('requests each input as required (except github-token)', () => {
    readActionInputs()

    expect(mockGetInput).toHaveBeenCalledWith('jira-base-url', { required: true })
    expect(mockGetInput).toHaveBeenCalledWith('jira-user-email', { required: true })
    expect(mockGetInput).toHaveBeenCalledWith('jira-api-token', { required: true })
    expect(mockGetInput).toHaveBeenCalledWith('jira-project-key', { required: true })
    expect(mockGetInput).toHaveBeenCalledWith('jira-epic-key', { required: true })
    expect(mockGetInput).toHaveBeenCalledWith('github-token', { required: false })
  })
})
```

- [ ] **Step 3: Run the test to confirm it fails**

Run: `npx jest src/__tests__/inputs.test.ts`
Expected: FAIL — `Cannot find module '../inputs'`

- [ ] **Step 4: Implement `src/inputs.ts`**

```typescript
import * as core from '@actions/core'

export interface ActionInputs {
  jiraBaseUrl: string
  jiraUserEmail: string
  jiraApiToken: string
  jiraProjectKey: string
  jiraEpicKey: string
  githubToken: string
}

export function readActionInputs(): ActionInputs {
  return {
    jiraBaseUrl: core.getInput('jira-base-url', { required: true }),
    jiraUserEmail: core.getInput('jira-user-email', { required: true }),
    jiraApiToken: core.getInput('jira-api-token', { required: true }),
    jiraProjectKey: core.getInput('jira-project-key', { required: true }),
    jiraEpicKey: core.getInput('jira-epic-key', { required: true }),
    githubToken: core.getInput('github-token', { required: false }),
  }
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npx jest src/__tests__/inputs.test.ts`
Expected: PASS — 2 tests passing.

- [ ] **Step 6: Commit**

```bash
git add src/inputs.ts src/__tests__/inputs.test.ts
git commit -Ss -m "feat(inputs): add readActionInputs with typed ActionInputs interface

Maps all action.yml inputs to a single ActionInputs object.
Separates input reading from business logic so handlers never call core.getInput directly."
```

---

## Task 5: Implement `github-client.ts`

**Files:**
- Create: `src/github-client.ts`
- Create: `src/__tests__/github-client.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/github-client.test.ts`:

```typescript
import * as github from '@actions/github'
import { createGitHubClient } from '../github-client'

jest.mock('@actions/github')

const mockCreateComment = jest.fn()
const mockListComments = jest.fn()

const mockGetOctokit = github.getOctokit as jest.MockedFunction<typeof github.getOctokit>
mockGetOctokit.mockReturnValue({
  rest: {
    issues: {
      createComment: mockCreateComment,
      listComments: mockListComments,
    },
  },
} as unknown as ReturnType<typeof github.getOctokit>)

Object.defineProperty(github, 'context', {
  value: { repo: { owner: 'test-owner', repo: 'test-repo' } },
  writable: true,
})

describe('createGitHubClient', () => {
  const client = createGitHubClient('test-github-token')

  describe('postComment', () => {
    it('posts a comment on the specified GitHub issue', async () => {
      mockCreateComment.mockResolvedValue({})

      await client.postComment(42, 'Hello from the test')

      expect(mockCreateComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 42,
        body: 'Hello from the test',
      })
    })
  })

  describe('fetchComments', () => {
    it('returns an array of comments with id and body', async () => {
      mockListComments.mockResolvedValue({
        data: [
          { id: 1, body: 'First comment' },
          { id: 2, body: 'Second comment' },
        ],
      })

      const comments = await client.fetchComments(42)

      expect(comments).toEqual([
        { id: 1, body: 'First comment' },
        { id: 2, body: 'Second comment' },
      ])
    })

    it('replaces a null comment body with an empty string', async () => {
      mockListComments.mockResolvedValue({
        data: [{ id: 1, body: null }],
      })

      const comments = await client.fetchComments(42)

      expect(comments).toEqual([{ id: 1, body: '' }])
    })
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx jest src/__tests__/github-client.test.ts`
Expected: FAIL — `Cannot find module '../github-client'`

- [ ] **Step 3: Implement `src/github-client.ts`**

```typescript
import * as github from '@actions/github'

export interface GitHubComment {
  id: number
  body: string
}

export interface GitHubClient {
  postComment: (issueNumber: number, body: string) => Promise<void>
  fetchComments: (issueNumber: number) => Promise<GitHubComment[]>
}

export function createGitHubClient(githubToken: string): GitHubClient {
  const octokit = github.getOctokit(githubToken)
  const { owner, repo } = github.context.repo

  async function postComment(issueNumber: number, body: string): Promise<void> {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    })
  }

  async function fetchComments(issueNumber: number): Promise<GitHubComment[]> {
    const response = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
    })
    return response.data.map((comment) => ({
      id: comment.id,
      body: comment.body ?? '',
    }))
  }

  return { postComment, fetchComments }
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx jest src/__tests__/github-client.test.ts`
Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/github-client.ts src/__tests__/github-client.test.ts
git commit -Ss -m "feat(github-client): add GitHub API client with postComment and fetchComments

Wraps @actions/github Octokit. Normalises null comment bodies to empty strings
so callers never have to handle null."
```

---

## Task 6: Implement `jira-client.ts`

**Files:**
- Create: `src/jira-client.ts`
- Create: `src/__tests__/jira-client.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/jira-client.test.ts`:

```typescript
import axios from 'axios'
import { createJiraClient } from '../jira-client'

jest.mock('axios')

const mockAxiosPost = axios.post as jest.MockedFunction<typeof axios.post>
const mockAxiosGet = axios.get as jest.MockedFunction<typeof axios.get>

const jiraBaseUrl = 'https://test.atlassian.net'
const jiraUserEmail = 'test@example.com'
const jiraApiToken = 'test-api-token'
const expectedAuthorizationHeader = `Basic ${Buffer.from(`${jiraUserEmail}:${jiraApiToken}`).toString('base64')}`
const expectedHeaders = {
  Authorization: expectedAuthorizationHeader,
  'Content-Type': 'application/json',
  Accept: 'application/json',
}

describe('createJiraClient', () => {
  const client = createJiraClient(jiraBaseUrl, jiraUserEmail, jiraApiToken)

  describe('createTask', () => {
    it('creates a Jira task and returns the issue key and browse URL', async () => {
      mockAxiosPost.mockResolvedValue({ data: { key: 'TEST-123' } })

      const result = await client.createTask(
        'TEST',
        'Fix the login bug',
        'Users cannot log in when 2FA is enabled.\n\nGitHub issue: https://github.com/org/repo/issues/1',
        'TEST-1',
      )

      expect(result).toEqual({
        jiraIssueKey: 'TEST-123',
        jiraIssueUrl: 'https://test.atlassian.net/browse/TEST-123',
      })
    })

    it('sends the correct request body to the Jira API', async () => {
      mockAxiosPost.mockResolvedValue({ data: { key: 'TEST-123' } })

      await client.createTask(
        'TEST',
        'Fix the login bug',
        'Users cannot log in when 2FA is enabled.\n\nGitHub issue: https://github.com/org/repo/issues/1',
        'TEST-1',
      )

      expect(mockAxiosPost).toHaveBeenCalledWith(
        'https://test.atlassian.net/rest/api/3/issue',
        {
          fields: {
            project: { key: 'TEST' },
            issuetype: { name: 'Task' },
            summary: 'Fix the login bug',
            description: {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      type: 'text',
                      text: 'Users cannot log in when 2FA is enabled.\n\nGitHub issue: https://github.com/org/repo/issues/1',
                    },
                  ],
                },
              ],
            },
            parent: { key: 'TEST-1' },
          },
        },
        { headers: expectedHeaders },
      )
    })
  })

  describe('transitionToDone', () => {
    it('finds the Done transition and applies it to the issue', async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          transitions: [
            { id: '11', name: 'To Do' },
            { id: '21', name: 'In Progress' },
            { id: '31', name: 'Done' },
          ],
        },
      })
      mockAxiosPost.mockResolvedValue({})

      await client.transitionToDone('TEST-123')

      expect(mockAxiosPost).toHaveBeenCalledWith(
        'https://test.atlassian.net/rest/api/3/issue/TEST-123/transitions',
        { transition: { id: '31' } },
        { headers: expectedHeaders },
      )
    })

    it('throws a descriptive error when the Done transition is not available', async () => {
      mockAxiosGet.mockResolvedValue({
        data: {
          transitions: [
            { id: '11', name: 'To Do' },
            { id: '21', name: 'In Progress' },
          ],
        },
      })

      await expect(client.transitionToDone('TEST-123')).rejects.toThrow(
        'Could not find "Done" transition for Jira issue TEST-123. Available transitions: To Do, In Progress',
      )
    })
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx jest src/__tests__/jira-client.test.ts`
Expected: FAIL — `Cannot find module '../jira-client'`

- [ ] **Step 3: Implement `src/jira-client.ts`**

```typescript
import axios from 'axios'

export interface JiraTaskCreationResult {
  jiraIssueKey: string
  jiraIssueUrl: string
}

interface JiraTransition {
  id: string
  name: string
}

export interface JiraClient {
  createTask: (
    jiraProjectKey: string,
    summary: string,
    description: string,
    jiraEpicKey: string,
  ) => Promise<JiraTaskCreationResult>
  transitionToDone: (jiraIssueKey: string) => Promise<void>
}

export function createJiraClient(
  jiraBaseUrl: string,
  jiraUserEmail: string,
  jiraApiToken: string,
): JiraClient {
  const authorizationHeader = `Basic ${Buffer.from(`${jiraUserEmail}:${jiraApiToken}`).toString('base64')}`
  const headers = {
    Authorization: authorizationHeader,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }

  function buildJiraApiErrorMessage(error: unknown, contextMessage: string): string {
    if (axios.isAxiosError(error) && error.response) {
      return `${contextMessage}: HTTP ${error.response.status} — ${JSON.stringify(error.response.data)}`
    }
    return contextMessage
  }

  async function createTask(
    jiraProjectKey: string,
    summary: string,
    description: string,
    jiraEpicKey: string,
  ): Promise<JiraTaskCreationResult> {
    try {
      const response = await axios.post(
        `${jiraBaseUrl}/rest/api/3/issue`,
        {
          fields: {
            project: { key: jiraProjectKey },
            issuetype: { name: 'Task' },
            summary,
            description: {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: description }],
                },
              ],
            },
            parent: { key: jiraEpicKey },
          },
        },
        { headers },
      )

      const jiraIssueKey = response.data.key as string
      const jiraIssueUrl = `${jiraBaseUrl}/browse/${jiraIssueKey}`

      return { jiraIssueKey, jiraIssueUrl }
    } catch (error) {
      throw new Error(buildJiraApiErrorMessage(error, 'Failed to create Jira task'))
    }
  }

  async function transitionToDone(jiraIssueKey: string): Promise<void> {
    let availableTransitions: JiraTransition[]

    try {
      const transitionsResponse = await axios.get(
        `${jiraBaseUrl}/rest/api/3/issue/${jiraIssueKey}/transitions`,
        { headers },
      )
      availableTransitions = transitionsResponse.data.transitions
    } catch (error) {
      throw new Error(
        buildJiraApiErrorMessage(error, `Failed to fetch transitions for Jira issue ${jiraIssueKey}`),
      )
    }

    const doneTransition = availableTransitions.find((transition) => transition.name === 'Done')

    if (!doneTransition) {
      const availableTransitionNames = availableTransitions.map((t) => t.name).join(', ')
      throw new Error(
        `Could not find "Done" transition for Jira issue ${jiraIssueKey}. Available transitions: ${availableTransitionNames}`,
      )
    }

    try {
      await axios.post(
        `${jiraBaseUrl}/rest/api/3/issue/${jiraIssueKey}/transitions`,
        { transition: { id: doneTransition.id } },
        { headers },
      )
    } catch (error) {
      throw new Error(
        buildJiraApiErrorMessage(error, `Failed to transition Jira issue ${jiraIssueKey} to Done`),
      )
    }
  }

  return { createTask, transitionToDone }
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx jest src/__tests__/jira-client.test.ts`
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/jira-client.ts src/__tests__/jira-client.test.ts
git commit -Ss -m "feat(jira-client): add Jira API client with createTask and transitionToDone

createTask links the new task to an Epic via the parent field (works for
next-gen Jira projects). transitionToDone looks up the transition ID at
runtime so it works regardless of how transitions are numbered."
```

---

## Task 7: Implement `handlers/opened.ts`

**Files:**
- Create: `src/handlers/opened.ts`
- Create: `src/__tests__/handlers/opened.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/handlers/opened.test.ts`:

```typescript
import * as core from '@actions/core'
import { handleIssueOpened } from '../../handlers/opened'
import { createJiraClient } from '../../jira-client'
import { createGitHubClient } from '../../github-client'
import { ActionInputs } from '../../inputs'

jest.mock('@actions/core')
jest.mock('../../jira-client')
jest.mock('../../github-client')

const mockCreateJiraClient = createJiraClient as jest.MockedFunction<typeof createJiraClient>
const mockCreateGitHubClient = createGitHubClient as jest.MockedFunction<typeof createGitHubClient>

const testInputs: ActionInputs = {
  jiraBaseUrl: 'https://test.atlassian.net',
  jiraUserEmail: 'test@example.com',
  jiraApiToken: 'test-api-token',
  jiraProjectKey: 'TEST',
  jiraEpicKey: 'TEST-1',
  githubToken: 'github-test-token',
}

const testIssue = {
  number: 42,
  title: 'Fix the login bug',
  body: 'Users cannot log in when 2FA is enabled.',
  html_url: 'https://github.com/org/repo/issues/42',
}

describe('handleIssueOpened', () => {
  const mockCreateTask = jest.fn()
  const mockPostComment = jest.fn()

  beforeEach(() => {
    mockCreateJiraClient.mockReturnValue({
      createTask: mockCreateTask,
      transitionToDone: jest.fn(),
    })
    mockCreateGitHubClient.mockReturnValue({
      postComment: mockPostComment,
      fetchComments: jest.fn(),
    })
    mockCreateTask.mockResolvedValue({
      jiraIssueKey: 'TEST-99',
      jiraIssueUrl: 'https://test.atlassian.net/browse/TEST-99',
    })
    mockPostComment.mockResolvedValue(undefined)
  })

  it('creates a Jira task with the issue title and a description combining body and GitHub URL', async () => {
    await handleIssueOpened(testIssue, testInputs)

    expect(mockCreateTask).toHaveBeenCalledWith(
      'TEST',
      'Fix the login bug',
      'Users cannot log in when 2FA is enabled.\n\nGitHub issue: https://github.com/org/repo/issues/42',
      'TEST-1',
    )
  })

  it('posts a markdown comment on the GitHub issue with the Jira task link', async () => {
    await handleIssueOpened(testIssue, testInputs)

    expect(mockPostComment).toHaveBeenCalledWith(
      42,
      'Jira task created: [TEST-99](https://test.atlassian.net/browse/TEST-99)',
    )
  })

  it('uses only the GitHub URL as the description when the issue has no body', async () => {
    await handleIssueOpened({ ...testIssue, body: null }, testInputs)

    expect(mockCreateTask).toHaveBeenCalledWith(
      'TEST',
      'Fix the login bug',
      'GitHub issue: https://github.com/org/repo/issues/42',
      'TEST-1',
    )
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx jest src/__tests__/handlers/opened.test.ts`
Expected: FAIL — `Cannot find module '../../handlers/opened'`

- [ ] **Step 3: Create the handlers directory and implement `handlers/opened.ts`**

Run: `mkdir -p src/handlers`

```typescript
import * as core from '@actions/core'
import { ActionInputs } from '../inputs'
import { createJiraClient } from '../jira-client'
import { createGitHubClient } from '../github-client'

interface GitHubIssueOpenedPayload {
  number: number
  title: string
  body: string | null
  html_url: string
}

export async function handleIssueOpened(
  issue: GitHubIssueOpenedPayload,
  inputs: ActionInputs,
): Promise<void> {
  const jiraClient = createJiraClient(inputs.jiraBaseUrl, inputs.jiraUserEmail, inputs.jiraApiToken)
  const githubClient = createGitHubClient(inputs.githubToken)

  const jiraTaskDescription = buildJiraTaskDescription(issue.body, issue.html_url)

  const { jiraIssueKey, jiraIssueUrl } = await jiraClient.createTask(
    inputs.jiraProjectKey,
    issue.title,
    jiraTaskDescription,
    inputs.jiraEpicKey,
  )

  core.info(`Created Jira task: ${jiraIssueKey}`)

  const githubComment = `Jira task created: [${jiraIssueKey}](${jiraIssueUrl})`
  await githubClient.postComment(issue.number, githubComment)

  core.info(`Posted Jira task link as comment on GitHub issue #${issue.number}`)
}

function buildJiraTaskDescription(
  githubIssueBody: string | null,
  githubIssueUrl: string,
): string {
  if (githubIssueBody) {
    return `${githubIssueBody}\n\nGitHub issue: ${githubIssueUrl}`
  }
  return `GitHub issue: ${githubIssueUrl}`
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx jest src/__tests__/handlers/opened.test.ts`
Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/handlers/opened.ts src/__tests__/handlers/opened.test.ts
git commit -Ss -m "feat(handlers): add issue-opened handler

Orchestrates: create Jira task -> post GitHub comment with task link.
Handles issues with no body by omitting the body section from the Jira description."
```

---

## Task 8: Implement `handlers/closed.ts`

**Files:**
- Create: `src/handlers/closed.ts`
- Create: `src/__tests__/handlers/closed.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/handlers/closed.test.ts`:

```typescript
import * as core from '@actions/core'
import { handleIssueClosed, findJiraIssueKeyInComments } from '../../handlers/closed'
import { createJiraClient } from '../../jira-client'
import { createGitHubClient } from '../../github-client'
import { ActionInputs } from '../../inputs'

jest.mock('@actions/core')
jest.mock('../../jira-client')
jest.mock('../../github-client')

const mockCreateJiraClient = createJiraClient as jest.MockedFunction<typeof createJiraClient>
const mockCreateGitHubClient = createGitHubClient as jest.MockedFunction<typeof createGitHubClient>

const testInputs: ActionInputs = {
  jiraBaseUrl: 'https://test.atlassian.net',
  jiraUserEmail: 'test@example.com',
  jiraApiToken: 'test-api-token',
  jiraProjectKey: 'TEST',
  jiraEpicKey: 'TEST-1',
  githubToken: 'github-test-token',
}

describe('handleIssueClosed', () => {
  const mockTransitionToDone = jest.fn()
  const mockFetchComments = jest.fn()
  const mockPostComment = jest.fn()
  const mockCoreWarning = core.warning as jest.MockedFunction<typeof core.warning>

  beforeEach(() => {
    mockCreateJiraClient.mockReturnValue({
      createTask: jest.fn(),
      transitionToDone: mockTransitionToDone,
    })
    mockCreateGitHubClient.mockReturnValue({
      postComment: mockPostComment,
      fetchComments: mockFetchComments,
    })
    mockTransitionToDone.mockResolvedValue(undefined)
    mockPostComment.mockResolvedValue(undefined)
  })

  it('transitions the linked Jira task to Done when the link comment is found', async () => {
    mockFetchComments.mockResolvedValue([
      { id: 1, body: 'An unrelated comment' },
      {
        id: 2,
        body: 'Jira task created: [TEST-99](https://test.atlassian.net/browse/TEST-99)',
      },
    ])

    await handleIssueClosed({ number: 42 }, testInputs)

    expect(mockTransitionToDone).toHaveBeenCalledWith('TEST-99')
    expect(mockPostComment).not.toHaveBeenCalled()
  })

  it('logs a warning and posts a comment when no Jira link comment is found', async () => {
    mockFetchComments.mockResolvedValue([{ id: 1, body: 'Just a regular comment' }])

    await handleIssueClosed({ number: 42 }, testInputs)

    expect(mockTransitionToDone).not.toHaveBeenCalled()
    expect(mockCoreWarning).toHaveBeenCalled()
    expect(mockPostComment).toHaveBeenCalledWith(
      42,
      expect.stringContaining('⚠️'),
    )
  })

  it('logs a warning and posts a comment when there are no comments at all', async () => {
    mockFetchComments.mockResolvedValue([])

    await handleIssueClosed({ number: 42 }, testInputs)

    expect(mockTransitionToDone).not.toHaveBeenCalled()
    expect(mockCoreWarning).toHaveBeenCalled()
    expect(mockPostComment).toHaveBeenCalled()
  })
})

describe('findJiraIssueKeyInComments', () => {
  it('returns the Jira issue key extracted from the bot comment', () => {
    const commentBodies = [
      'An unrelated comment',
      'Jira task created: [TEST-99](https://test.atlassian.net/browse/TEST-99)',
    ]
    expect(findJiraIssueKeyInComments(commentBodies)).toBe('TEST-99')
  })

  it('returns null when no Jira link comment is present', () => {
    expect(findJiraIssueKeyInComments(['Just a comment', 'Another comment'])).toBeNull()
  })

  it('returns null for an empty comment list', () => {
    expect(findJiraIssueKeyInComments([])).toBeNull()
  })

  it('handles multi-part project keys such as MYPROJECT-42', () => {
    const commentBodies = [
      'Jira task created: [MYPROJECT-42](https://test.atlassian.net/browse/MYPROJECT-42)',
    ]
    expect(findJiraIssueKeyInComments(commentBodies)).toBe('MYPROJECT-42')
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx jest src/__tests__/handlers/closed.test.ts`
Expected: FAIL — `Cannot find module '../../handlers/closed'`

- [ ] **Step 3: Implement `src/handlers/closed.ts`**

```typescript
import * as core from '@actions/core'
import { ActionInputs } from '../inputs'
import { createJiraClient } from '../jira-client'
import { createGitHubClient } from '../github-client'

interface GitHubIssueClosedPayload {
  number: number
}

// Matches the comment posted by handleIssueOpened, e.g.:
// "Jira task created: [TEST-99](https://test.atlassian.net/browse/TEST-99)"
const JIRA_TASK_LINK_COMMENT_PATTERN = /Jira task created: \[([A-Z][A-Z0-9]+-\d+)\]\([^)]+\)/

export async function handleIssueClosed(
  issue: GitHubIssueClosedPayload,
  inputs: ActionInputs,
): Promise<void> {
  const jiraClient = createJiraClient(inputs.jiraBaseUrl, inputs.jiraUserEmail, inputs.jiraApiToken)
  const githubClient = createGitHubClient(inputs.githubToken)

  const comments = await githubClient.fetchComments(issue.number)
  const commentBodies = comments.map((comment) => comment.body)
  const jiraIssueKey = findJiraIssueKeyInComments(commentBodies)

  if (!jiraIssueKey) {
    const warningMessage =
      `Could not find a linked Jira task in the comments of GitHub issue #${issue.number}. ` +
      `The Jira task was not updated.`

    core.warning(warningMessage)

    await githubClient.postComment(
      issue.number,
      `⚠️ ${warningMessage}`,
    )
    return
  }

  await jiraClient.transitionToDone(jiraIssueKey)
  core.info(`Transitioned Jira task ${jiraIssueKey} to Done`)
}

export function findJiraIssueKeyInComments(commentBodies: string[]): string | null {
  for (const body of commentBodies) {
    const match = body.match(JIRA_TASK_LINK_COMMENT_PATTERN)
    if (match) {
      return match[1]
    }
  }
  return null
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx jest src/__tests__/handlers/closed.test.ts`
Expected: PASS — 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/handlers/closed.ts src/__tests__/handlers/closed.test.ts
git commit -Ss -m "feat(handlers): add issue-closed handler

Orchestrates: fetch comments -> find Jira link -> transition to Done.
When no link is found, logs a warning and posts a comment on the issue
so the author knows the sync was skipped."
```

---

## Task 9: Implement `index.ts`

**Files:**
- Create: `src/index.ts`
- Create: `src/__tests__/index.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/index.test.ts`:

```typescript
import * as core from '@actions/core'
import * as github from '@actions/github'
import { handleIssueOpened } from '../handlers/opened'
import { handleIssueClosed } from '../handlers/closed'
import { readActionInputs } from '../inputs'

jest.mock('@actions/core')
jest.mock('@actions/github')
jest.mock('../handlers/opened')
jest.mock('../handlers/closed')
jest.mock('../inputs')

const mockReadActionInputs = readActionInputs as jest.MockedFunction<typeof readActionInputs>
const mockHandleIssueOpened = handleIssueOpened as jest.MockedFunction<typeof handleIssueOpened>
const mockHandleIssueClosed = handleIssueClosed as jest.MockedFunction<typeof handleIssueClosed>
const mockSetFailed = core.setFailed as jest.MockedFunction<typeof core.setFailed>

const testInputs = {
  jiraBaseUrl: 'https://test.atlassian.net',
  jiraUserEmail: 'test@example.com',
  jiraApiToken: 'test-api-token',
  jiraProjectKey: 'TEST',
  jiraEpicKey: 'TEST-1',
  githubToken: 'github-test-token',
}

const testIssue = {
  number: 1,
  title: 'Test issue',
  body: null,
  html_url: 'https://github.com/org/repo/issues/1',
}

// We import and call run() directly rather than auto-running on module load
// so that tests can set up mocks before the action logic executes.
import { run } from '../index'

describe('run', () => {
  beforeEach(() => {
    mockReadActionInputs.mockReturnValue(testInputs)
    mockHandleIssueOpened.mockResolvedValue(undefined)
    mockHandleIssueClosed.mockResolvedValue(undefined)
  })

  it('calls handleIssueOpened when the event action is "opened"', async () => {
    Object.defineProperty(github, 'context', {
      value: { payload: { action: 'opened', issue: testIssue } },
      writable: true,
    })

    await run()

    expect(mockHandleIssueOpened).toHaveBeenCalledWith(testIssue, testInputs)
    expect(mockHandleIssueClosed).not.toHaveBeenCalled()
  })

  it('calls handleIssueClosed when the event action is "closed"', async () => {
    Object.defineProperty(github, 'context', {
      value: { payload: { action: 'closed', issue: testIssue } },
      writable: true,
    })

    await run()

    expect(mockHandleIssueClosed).toHaveBeenCalledWith(testIssue, testInputs)
    expect(mockHandleIssueOpened).not.toHaveBeenCalled()
  })

  it('calls core.setFailed when the event payload contains no issue', async () => {
    Object.defineProperty(github, 'context', {
      value: { payload: { action: 'opened', issue: undefined } },
      writable: true,
    })

    await run()

    expect(mockSetFailed).toHaveBeenCalledWith(
      expect.stringContaining('issue event'),
    )
  })

  it('calls core.setFailed for an unexpected event action', async () => {
    Object.defineProperty(github, 'context', {
      value: { payload: { action: 'edited', issue: testIssue } },
      writable: true,
    })

    await run()

    expect(mockSetFailed).toHaveBeenCalledWith(
      expect.stringContaining('"edited"'),
    )
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx jest src/__tests__/index.test.ts`
Expected: FAIL — `Cannot find module '../index'` or `run is not exported`

- [ ] **Step 3: Implement `src/index.ts`**

```typescript
import * as core from '@actions/core'
import * as github from '@actions/github'
import { readActionInputs } from './inputs'
import { handleIssueOpened } from './handlers/opened'
import { handleIssueClosed } from './handlers/closed'

export async function run(): Promise<void> {
  const inputs = readActionInputs()
  const eventAction = github.context.payload.action
  // @actions/github types the payload loosely; we cast to any and let the
  // handler interfaces enforce the shape at the TypeScript level.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const issue = github.context.payload.issue as any

  if (!issue) {
    core.setFailed('This action must be triggered by an issue event, but the payload contained no issue.')
    return
  }

  if (eventAction === 'opened') {
    await handleIssueOpened(issue, inputs)
  } else if (eventAction === 'closed') {
    await handleIssueClosed(issue, inputs)
  } else {
    core.setFailed(
      `Unexpected issue event action: "${eventAction}". This action only handles "opened" and "closed" events.`,
    )
  }
}

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error))
})
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx jest src/__tests__/index.test.ts`
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — all tests across all files passing.

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/index.ts src/__tests__/index.test.ts
git commit -Ss -m "feat(index): add entry point that dispatches to opened/closed handlers

Exports run() for testability. The top-level run().catch() at the end
ensures any unhandled promise rejection is surfaced as a workflow failure
rather than swallowed."
```

---

## Task 10: Build `dist/` and verify the bundle

**Files:**
- Modify: none (this produces `dist/index.js`)

- [ ] **Step 1: Build the bundle**

Run: `npm run build`
Expected: `dist/index.js` and `dist/index.js.map` created. No TypeScript errors.

- [ ] **Step 2: Verify the bundle size is reasonable**

Run: `ls -lh dist/index.js`
Expected: file exists and is under 5 MB (typical range is 1–3 MB for this type of Action).

- [ ] **Step 3: Commit the bundle**

```bash
git add dist/
git commit -Ss -m "chore(build): add initial compiled dist bundle

dist/index.js is the file GitHub Actions runs when the Action is referenced.
It must be committed so no build step is required at runtime."
```

---

## Task 11: Add CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

Run: `mkdir -p .github/workflows`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    name: Lint, typecheck, and test
    runs-on: ubuntu-latest

    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      - name: Run tests
        run: npm test
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -Ss -m "ci: add CI workflow that lints, typechecks, and runs tests

Runs on push to main and on all pull requests.
Uses npm ci for reproducible installs from package-lock.json."
```

---

## Task 12: Add release workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create `.github/workflows/release.yml`**

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    name: Build and publish release
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Check out repository
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build dist bundle
        run: npm run build

      - name: Commit updated dist to the tag
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add dist/
          git diff --staged --quiet || git commit -m "chore(release): update dist bundle for ${{ github.ref_name }}"
          git push

      - name: Create GitHub Release with auto-generated notes
        run: |
          gh release create "${{ github.ref_name }}" \
            --title "${{ github.ref_name }}" \
            --generate-notes
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -Ss -m "ci: add release workflow triggered on v* tag push

Runs tests, builds dist/, commits the updated bundle back to the tag,
then creates a GitHub Release with auto-generated notes from commit history."
```

---

## Task 13: Write `README.md`

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# jira-issue-sync

A GitHub Action that keeps GitHub issues and Jira tasks in sync.

- When a GitHub issue is **opened**, a Jira Task is created and linked to a specified Epic. A comment is posted on the GitHub issue with a link to the Jira task.
- When a GitHub issue is **closed**, the linked Jira task is transitioned to **Done**.

GitHub is the source of truth.

## Usage

Add this workflow file to any repository you want to sync:

```yaml
# .github/workflows/jira-sync.yml
name: Sync issues with Jira

on:
  issues:
    types: [opened, closed]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: your-github-handle/jira-issue-sync@v1
        with:
          jira-base-url: ${{ secrets.JIRA_BASE_URL }}
          jira-user-email: ${{ secrets.JIRA_USER_EMAIL }}
          jira-api-token: ${{ secrets.JIRA_API_TOKEN }}
          jira-project-key: 'MYPROJECT'
          jira-epic-key: 'MYPROJECT-42'
```

## Inputs

| Input | Required | Description |
|---|---|---|
| `jira-base-url` | yes | Your Atlassian domain, e.g. `https://your-org.atlassian.net` |
| `jira-user-email` | yes | Email of the Jira user whose API token you are using |
| `jira-api-token` | yes | Jira API token — store this as a GitHub secret |
| `jira-project-key` | yes | Key of the Jira project where tasks will be created |
| `jira-epic-key` | yes | Key of the Jira Epic to link new tasks to |
| `github-token` | no | GitHub token for posting comments. Defaults to `${{ github.token }}` |

## Setting up secrets

In your repository, go to **Settings → Secrets and variables → Actions** and add:

- `JIRA_BASE_URL` — e.g. `https://your-org.atlassian.net`
- `JIRA_USER_EMAIL` — the email address linked to your Jira API token
- `JIRA_API_TOKEN` — generate one at https://id.atlassian.com/manage-profile/security/api-tokens

## How it works

When an issue is opened, the Action creates a Jira Task and posts this comment:

> Jira task created: [PROJ-123](https://your-org.atlassian.net/browse/PROJ-123)

When the issue is closed, the Action reads that comment to find the Jira issue key and transitions the task to Done.

If the comment was deleted before the issue was closed, the Action posts a warning comment on the issue and exits without failing the workflow.

## Jira project compatibility

Task creation uses the `parent` field to link to an Epic. This works with **next-gen (team-managed) Jira projects**. Classic (company-managed) projects may use a different field (`customfield_10014`). Support for classic projects will be added in a future release.

## Releasing a new version

Push a tag following the `vMAJOR.MINOR.PATCH` convention:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The release workflow will build `dist/`, commit it, and create a GitHub Release automatically.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -Ss -m "docs(readme): add usage instructions, input reference, and release guide

Explains the full sync flow, how to configure secrets, Jira project
compatibility notes, and how to publish a new release."
```

---

## Task 14: Final verification

- [ ] **Step 1: Run the full test suite one last time**

Run: `npm test`
Expected: all tests pass with no failures.

- [ ] **Step 2: Run lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Verify the build produces a valid bundle**

Run: `npm run build`
Expected: `dist/index.js` created with no errors.

- [ ] **Step 4: Check the git log looks clean and conventional**

Run: `git log --oneline`
Expected: each commit has a conventional commit prefix (`feat:`, `chore:`, `ci:`, `docs:`).

---

## Notes for the implementer

**Classic Jira projects:** The `parent` field used in `createTask` links to an Epic in next-gen projects. In classic projects you may need to use `customfield_10014` instead. If the `createTask` call returns a 400 error mentioning the `parent` field, this is why. This is documented in the README as a known limitation.

**GitHub token permissions:** The default `GITHUB_TOKEN` has write permission to issues, so posting comments works out of the box. No extra configuration is needed.

**Testing the Action end-to-end:** After deploying, create a test issue in a repository that has the workflow installed. Watch the Actions tab to see the sync run. Check that a Jira task appears in your project and that a comment appears on the GitHub issue.
