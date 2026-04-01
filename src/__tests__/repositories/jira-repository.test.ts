import axios from 'axios'
import { createJiraRepository } from '../../repositories/jira-repository'

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

describe('createJiraRepository', () => {
  const client = createJiraRepository(jiraBaseUrl, jiraUserEmail, jiraApiToken)

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
