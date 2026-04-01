import * as core from '@actions/core'
import { ActionInputs } from '../inputs'
import { createJiraRepository } from '../repositories/jira-repository'
import { createGitHubRepository } from '../repositories/github-repository'

interface GitHubIssueOpenedPayload {
  number: number
  title: string
  body: string | null
  html_url: string
}

export async function orchestrateIssueOpened(
  issue: GitHubIssueOpenedPayload,
  inputs: ActionInputs,
): Promise<void> {
  const jiraRepository = createJiraRepository(
    inputs.jiraBaseUrl,
    inputs.jiraUserEmail,
    inputs.jiraApiToken,
  )
  const githubRepository = createGitHubRepository(inputs.githubToken)

  const jiraTaskDescription = buildJiraTaskDescription(issue.body, issue.html_url)

  const { jiraIssueKey, jiraIssueUrl } = await jiraRepository.createTask(
    inputs.jiraProjectKey,
    issue.title,
    jiraTaskDescription,
    inputs.jiraEpicKey,
  )

  core.info(`Created Jira task: ${jiraIssueKey}`)

  const githubComment = `Jira task created: [${jiraIssueKey}](${jiraIssueUrl})`
  await githubRepository.postComment(issue.number, githubComment)

  core.info(`Posted Jira task link as comment on GitHub issue #${issue.number}`)
}

function buildJiraTaskDescription(githubIssueBody: string | null, githubIssueUrl: string): string {
  if (githubIssueBody) {
    return `${githubIssueBody}\n\nGitHub issue: ${githubIssueUrl}`
  }
  return `GitHub issue: ${githubIssueUrl}`
}
