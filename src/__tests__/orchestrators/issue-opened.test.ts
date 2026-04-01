import { orchestrateIssueOpened } from '../../orchestrators/issue-opened'
import { createJiraRepository } from '../../repositories/jira-repository'
import { createGitHubRepository } from '../../repositories/github-repository'
import { ActionInputs } from '../../inputs'

jest.mock('@actions/core')
jest.mock('../../repositories/jira-repository')
jest.mock('../../repositories/github-repository')

const mockCreateJiraRepository = createJiraRepository as jest.MockedFunction<
  typeof createJiraRepository
>
const mockCreateGitHubRepository = createGitHubRepository as jest.MockedFunction<
  typeof createGitHubRepository
>

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

describe('orchestrateIssueOpened', () => {
  const mockCreateTask = jest.fn()
  const mockPostComment = jest.fn()

  beforeEach(() => {
    mockCreateJiraRepository.mockReturnValue({
      createTask: mockCreateTask,
      transitionToDone: jest.fn(),
    })
    mockCreateGitHubRepository.mockReturnValue({
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
    await orchestrateIssueOpened(testIssue, testInputs)

    expect(mockCreateTask).toHaveBeenCalledWith(
      'TEST',
      'Fix the login bug',
      'Users cannot log in when 2FA is enabled.\n\nGitHub issue: https://github.com/org/repo/issues/42',
      'TEST-1',
    )
  })

  it('posts a markdown comment on the GitHub issue with the Jira task link', async () => {
    await orchestrateIssueOpened(testIssue, testInputs)

    expect(mockPostComment).toHaveBeenCalledWith(
      42,
      'Jira task created: [TEST-99](https://test.atlassian.net/browse/TEST-99)',
    )
  })

  it('uses only the GitHub URL as the description when the issue has no body', async () => {
    await orchestrateIssueOpened({ ...testIssue, body: null }, testInputs)

    expect(mockCreateTask).toHaveBeenCalledWith(
      'TEST',
      'Fix the login bug',
      'GitHub issue: https://github.com/org/repo/issues/42',
      'TEST-1',
    )
  })
})
