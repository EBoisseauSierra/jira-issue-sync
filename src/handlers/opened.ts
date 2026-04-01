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

function buildJiraTaskDescription(githubIssueBody: string | null, githubIssueUrl: string): string {
  if (githubIssueBody) {
    return `${githubIssueBody}\n\nGitHub issue: ${githubIssueUrl}`
  }
  return `GitHub issue: ${githubIssueUrl}`
}
