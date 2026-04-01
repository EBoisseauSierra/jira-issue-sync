import * as core from '@actions/core'
import {
  orchestrateIssueClosed,
  findJiraIssueKeyInComments,
} from '../../orchestrators/issue-closed'
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

describe('orchestrateIssueClosed', () => {
  const mockTransitionToDone = jest.fn()
  const mockFetchComments = jest.fn()
  const mockPostComment = jest.fn()
  const mockCoreWarning = core.warning as jest.MockedFunction<typeof core.warning>

  beforeEach(() => {
    mockCreateJiraRepository.mockReturnValue({
      createTask: jest.fn(),
      transitionToDone: mockTransitionToDone,
    })
    mockCreateGitHubRepository.mockReturnValue({
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

    await orchestrateIssueClosed({ number: 42 }, testInputs)

    expect(mockTransitionToDone).toHaveBeenCalledWith('TEST-99')
    expect(mockPostComment).not.toHaveBeenCalled()
  })

  it('logs a warning and posts a comment when no Jira link comment is found', async () => {
    mockFetchComments.mockResolvedValue([{ id: 1, body: 'Just a regular comment' }])

    await orchestrateIssueClosed({ number: 42 }, testInputs)

    expect(mockTransitionToDone).not.toHaveBeenCalled()
    expect(mockCoreWarning).toHaveBeenCalled()
    expect(mockPostComment).toHaveBeenCalledWith(42, expect.stringContaining('\u26a0\ufe0f'))
  })

  it('logs a warning and posts a comment when there are no comments at all', async () => {
    mockFetchComments.mockResolvedValue([])

    await orchestrateIssueClosed({ number: 42 }, testInputs)

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
