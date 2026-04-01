import * as core from '@actions/core'
import * as github from '@actions/github'
import { handleIssueOpened } from '../handlers/opened'
import { handleIssueClosed } from '../handlers/closed'
import { readActionInputs } from '../inputs'

jest.mock('@actions/core')
jest.mock('@actions/github')
jest.mock('../handlers/opened')
jest.mock('../handlers/closed')
jest.mock('../inputs')

const mockReadActionInputs = readActionInputs as jest.MockedFunction<typeof readActionInputs>
const mockHandleIssueOpened = handleIssueOpened as jest.MockedFunction<typeof handleIssueOpened>
const mockHandleIssueClosed = handleIssueClosed as jest.MockedFunction<typeof handleIssueClosed>
const mockSetFailed = core.setFailed as jest.MockedFunction<typeof core.setFailed>

const testInputs = {
  jiraBaseUrl: 'https://test.atlassian.net',
  jiraUserEmail: 'test@example.com',
  jiraApiToken: 'test-api-token',
  jiraProjectKey: 'TEST',
  jiraEpicKey: 'TEST-1',
  githubToken: 'github-test-token',
}

const testIssue = {
  number: 1,
  title: 'Test issue',
  body: null,
  html_url: 'https://github.com/org/repo/issues/1',
}

// We import and call run() directly rather than auto-running on module load
// so that tests can set up mocks before the action logic executes.
import { run } from '../index'

describe('run', () => {
  beforeEach(() => {
    mockReadActionInputs.mockReturnValue(testInputs)
    mockHandleIssueOpened.mockResolvedValue(undefined)
    mockHandleIssueClosed.mockResolvedValue(undefined)
  })

  it('calls handleIssueOpened when the event action is "opened"', async () => {
    Object.defineProperty(github, 'context', {
      value: { payload: { action: 'opened', issue: testIssue } },
      writable: true,
    })

    await run()

    expect(mockHandleIssueOpened).toHaveBeenCalledWith(testIssue, testInputs)
    expect(mockHandleIssueClosed).not.toHaveBeenCalled()
  })

  it('calls handleIssueClosed when the event action is "closed"', async () => {
    Object.defineProperty(github, 'context', {
      value: { payload: { action: 'closed', issue: testIssue } },
      writable: true,
    })

    await run()

    expect(mockHandleIssueClosed).toHaveBeenCalledWith(testIssue, testInputs)
    expect(mockHandleIssueOpened).not.toHaveBeenCalled()
  })

  it('calls core.setFailed when the event payload contains no issue', async () => {
    Object.defineProperty(github, 'context', {
      value: { payload: { action: 'opened', issue: undefined } },
      writable: true,
    })

    await run()

    expect(mockSetFailed).toHaveBeenCalledWith(expect.stringContaining('issue event'))
  })

  it('calls core.setFailed for an unexpected event action', async () => {
    Object.defineProperty(github, 'context', {
      value: { payload: { action: 'edited', issue: testIssue } },
      writable: true,
    })

    await run()

    expect(mockSetFailed).toHaveBeenCalledWith(expect.stringContaining('"edited"'))
  })
})
