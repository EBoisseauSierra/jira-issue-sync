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
