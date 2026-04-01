# GitHub-to-Jira Issues Sync

A GitHub Action that keeps Jira tasks in sync with GitHub issues.

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
      - uses: EBoisseauSierra/github-to-jira-issues-sync@v0
        with:
          jira-base-url: ${{ secrets.JIRA_BASE_URL }}
          jira-user-email: ${{ secrets.JIRA_USER_EMAIL }}
          jira-api-token: ${{ secrets.JIRA_API_TOKEN }}
          jira-project-key: ${{ vars.JIRA_PROJECT_KEY }}
          jira-epic-key: ${{ vars.JIRA_EPIC_KEY }}
```

## Inputs

| Input | Required | Description | Example |
|---|---|---|
| `jira-base-url` | yes | Your Atlassian domain, e.g. `https://your-org.atlassian.net` | `https://your-org.atlassian.net` |
| `jira-user-email` | yes | Email of the Jira user whose API token you are using | `user@example.com` |
| `jira-api-token` | yes | Jira API token — store this as a GitHub secret | `ghp_XXXXXXXXXXXXXXXXXXXX` |
| `jira-project-key` | yes | Key of the Jira project where tasks will be created | `PROJ` |
| `jira-epic-key` | yes | Key of the Jira Epic to link new tasks to | `PROJ-1` |
| `github-token` | no | GitHub token for posting comments. Defaults to `${{ github.token }}` | `${{ github.token }}` |

## Setting up secrets

In your repository, go to **Settings → Secrets and variables → Actions** and add:

- `JIRA_BASE_URL` — e.g. `https://your-org.atlassian.net`
- `JIRA_USER_EMAIL` — the email address linked to your Jira API token
- `JIRA_API_TOKEN` — generate one at <https://id.atlassian.com/manage-profile/security/api-tokens>

Then add the project and epic keys as repository variables under **Settings → Secrets and variables → Variables**:

- `JIRA_PROJECT_KEY` — the key of your Jira project (e.g. `PROJ`)
- `JIRA_EPIC_KEY` — the key of the Epic to link new tasks to (e.g. `PROJ-1`)

## How it works

When an issue is opened, the Action creates a Jira Task and posts this comment:

> Jira task created: [PROJ-123](https://your-org.atlassian.net/browse/PROJ-123)

When the issue is closed, the Action reads that comment to find the Jira issue key and transitions the task to Done.

If the comment was deleted before the issue was closed, the Action posts a warning comment on the issue and exits without failing the workflow.

## Versioning

This project follows [Semantic Versioning](https://semver.org) (`vMAJOR.MINOR.PATCH`) and [Conventional Commits](https://www.conventionalcommits.org).

Each release publishes a floating major-version tag (e.g. `v1`) that always points to the latest `v1.x.y` release. Pin to `@v1` for automatic minor/patch updates, or to a full tag like `@v1.2.3` for a locked version.

## Releasing a new version

Use the release script, which builds `dist/`, commits it if needed, tags, and pushes:

```bash
npm run release -- v1.0.0
```

The release workflow will then validate the build, create a GitHub Release, and update the floating `v1` tag automatically.
