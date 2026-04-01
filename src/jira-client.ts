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
        buildJiraApiErrorMessage(
          error,
          `Failed to fetch transitions for Jira issue ${jiraIssueKey}`,
        ),
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
