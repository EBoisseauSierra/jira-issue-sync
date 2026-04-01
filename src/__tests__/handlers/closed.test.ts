import * as core from '@actions/core'
import { handleIssueClosed, findJiraIssueKeyInComments } from '../../handlers/closed'
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

describe('handleIssueClosed', () => {
  const mockTransitionToDone = jest.fn()
  const mockFetchComments = jest.fn()
  const mockPostComment = jest.fn()
  const mockCoreWarning = core.warning as jest.MockedFunction<typeof core.warning>

  beforeEach(() => {
    mockCreateJiraClient.mockReturnValue({
      createTask: jest.fn(),
      transitionToDone: mockTransitionToDone,
    })
    mockCreateGitHubClient.mockReturnValue({
      postComment: mockPostComment,
      fetchComments: mockFetchComments,
    })
    mockTransitionToDone.mockResolvedValue(undefined)
    mockPostComment.mockResolvedValue(undefined)
  })

  it('transitions the linked Jira task to Done when the link comment is found', async () => {
    mockFetchComments.mockResolvedValue([
      { id: 1, body: 'An unrelated comment' },
      {
        id: 2,
        body: 'Jira task created: [TEST-99](https://test.atlassian.net/browse/TEST-99)',
      },
    ])

    await handleIssueClosed({ number: 42 }, testInputs)

    expect(mockTransitionToDone).toHaveBeenCalledWith('TEST-99')
    expect(mockPostComment).not.toHaveBeenCalled()
  })

  it('logs a warning and posts a comment when no Jira link comment is found', async () => {
    mockFetchComments.mockResolvedValue([{ id: 1, body: 'Just a regular comment' }])

    await handleIssueClosed({ number: 42 }, testInputs)

    expect(mockTransitionToDone).not.toHaveBeenCalled()
    expect(mockCoreWarning).toHaveBeenCalled()
    expect(mockPostComment).toHaveBeenCalledWith(42, expect.stringContaining('\u26a0\ufe0f'))
  })

  it('logs a warning and posts a comment when there are no comments at all', async () => {
    mockFetchComments.mockResolvedValue([])

    await handleIssueClosed({ number: 42 }, testInputs)

    expect(mockTransitionToDone).not.toHaveBeenCalled()
    expect(mockCoreWarning).toHaveBeenCalled()
    expect(mockPostComment).toHaveBeenCalled()
  })
})

describe('findJiraIssueKeyInComments', () => {
  it('returns the Jira issue key extracted from the bot comment', () => {
    const commentBodies = [
      'An unrelated comment',
      'Jira task created: [TEST-99](https://test.atlassian.net/browse/TEST-99)',
    ]
    expect(findJiraIssueKeyInComments(commentBodies)).toBe('TEST-99')
  })

  it('returns null when no Jira link comment is present', () => {
    expect(findJiraIssueKeyInComments(['Just a comment', 'Another comment'])).toBeNull()
  })

  it('returns null for an empty comment list', () => {
    expect(findJiraIssueKeyInComments([])).toBeNull()
  })

  it('handles multi-part project keys such as MYPROJECT-42', () => {
    const commentBodies = [
      'Jira task created: [MYPROJECT-42](https://test.atlassian.net/browse/MYPROJECT-42)',
    ]
    expect(findJiraIssueKeyInComments(commentBodies)).toBe('MYPROJECT-42')
  })
})
