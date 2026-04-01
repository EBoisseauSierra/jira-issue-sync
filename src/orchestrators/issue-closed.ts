import * as core from '@actions/core'
import { ActionInputs } from '../inputs'
import { createJiraRepository } from '../repositories/jira-repository'
import { createGitHubRepository } from '../repositories/github-repository'

interface GitHubIssueClosedPayload {
  number: number
}

// Matches the comment posted by orchestrateIssueOpened, e.g.:
// "Jira task created: [TEST-99](https://test.atlassian.net/browse/TEST-99)"
const JIRA_TASK_LINK_COMMENT_PATTERN = /Jira task created: \[([A-Z][A-Z0-9]+-\d+)\]\([^)]+\)/

export async function orchestrateIssueClosed(
  issue: GitHubIssueClosedPayload,
  inputs: ActionInputs,
): Promise<void> {
  const jiraRepository = createJiraRepository(
    inputs.jiraBaseUrl,
    inputs.jiraUserEmail,
    inputs.jiraApiToken,
  )
  const githubRepository = createGitHubRepository(inputs.githubToken)

  const comments = await githubRepository.fetchComments(issue.number)
  const commentBodies = comments.map((comment) => comment.body)
  const jiraIssueKey = findJiraIssueKeyInComments(commentBodies)

  if (!jiraIssueKey) {
    const warningMessage =
      `Could not find a linked Jira task in the comments of GitHub issue #${issue.number}. ` +
      `The Jira task was not updated.`

    core.warning(warningMessage)

    await githubRepository.postComment(issue.number, `\u26a0\ufe0f ${warningMessage}`)
    return
  }

  await jiraRepository.transitionToDone(jiraIssueKey)
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
