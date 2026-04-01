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

  const urlParts = new URL(issue.html_url).pathname.split('/')
  const githubIssueLink = {
    text: `${urlParts[1]}/${urlParts[2]}#${issue.number}`,
    url: issue.html_url,
  }

  const { jiraIssueKey, jiraIssueUrl } = await jiraRepository.createTask(
    inputs.jiraProjectKey,
    issue.title,
    issue.body,
    githubIssueLink,
    inputs.jiraEpicKey,
  )

  core.info(`Created Jira task: ${jiraIssueKey}`)

  const githubComment = `Jira task created: [${jiraIssueKey}](${jiraIssueUrl})`
  await githubRepository.postComment(issue.number, githubComment)

  core.info(`Posted Jira task link as comment on GitHub issue #${issue.number}`)
}
