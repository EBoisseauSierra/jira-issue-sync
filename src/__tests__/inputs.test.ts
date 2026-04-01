import * as core from '@actions/core'
import { readActionInputs } from '../inputs'

jest.mock('@actions/core')

const mockGetInput = core.getInput as jest.MockedFunction<typeof core.getInput>

describe('readActionInputs', () => {
  beforeEach(() => {
    mockGetInput.mockImplementation((name: string) => {
      const inputValues: Record<string, string> = {
        'jira-base-url': 'https://test.atlassian.net',
        'jira-user-email': 'test@example.com',
        'jira-api-token': 'test-api-token',
        'jira-project-key': 'TEST',
        'jira-epic-key': 'TEST-1',
        'github-token': 'github-test-token',
      }
      return inputValues[name] ?? ''
    })
  })

  it('reads all inputs and returns a typed ActionInputs object', () => {
    const inputs = readActionInputs()

    expect(inputs).toEqual({
      jiraBaseUrl: 'https://test.atlassian.net',
      jiraUserEmail: 'test@example.com',
      jiraApiToken: 'test-api-token',
      jiraProjectKey: 'TEST',
      jiraEpicKey: 'TEST-1',
      githubToken: 'github-test-token',
    })
  })

  it('requests each input as required (except github-token)', () => {
    readActionInputs()

    expect(mockGetInput).toHaveBeenCalledWith('jira-base-url', { required: true })
    expect(mockGetInput).toHaveBeenCalledWith('jira-user-email', { required: true })
    expect(mockGetInput).toHaveBeenCalledWith('jira-api-token', { required: true })
    expect(mockGetInput).toHaveBeenCalledWith('jira-project-key', { required: true })
    expect(mockGetInput).toHaveBeenCalledWith('jira-epic-key', { required: true })
    expect(mockGetInput).toHaveBeenCalledWith('github-token', { required: false })
  })
})
