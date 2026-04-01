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
