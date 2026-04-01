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

    await githubClient.postComment(issue.number, `\u26a0\ufe0f ${warningMessage}`)
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
