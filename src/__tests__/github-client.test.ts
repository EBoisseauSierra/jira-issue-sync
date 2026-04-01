import * as github from '@actions/github'
import { createGitHubClient } from '../github-client'

jest.mock('@actions/github')

const mockCreateComment = jest.fn()
const mockListComments = jest.fn()

const mockGetOctokit = github.getOctokit as jest.MockedFunction<typeof github.getOctokit>
mockGetOctokit.mockReturnValue({
  rest: {
    issues: {
      createComment: mockCreateComment,
      listComments: mockListComments,
    },
  },
} as unknown as ReturnType<typeof github.getOctokit>)

Object.defineProperty(github, 'context', {
  value: { repo: { owner: 'test-owner', repo: 'test-repo' } },
  writable: true,
})

describe('createGitHubClient', () => {
  const client = createGitHubClient('test-github-token')

  describe('postComment', () => {
    it('posts a comment on the specified GitHub issue', async () => {
      mockCreateComment.mockResolvedValue({})

      await client.postComment(42, 'Hello from the test')

      expect(mockCreateComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 42,
        body: 'Hello from the test',
      })
    })
  })

  describe('fetchComments', () => {
    it('returns an array of comments with id and body', async () => {
      mockListComments.mockResolvedValue({
        data: [
          { id: 1, body: 'First comment' },
          { id: 2, body: 'Second comment' },
        ],
      })

      const comments = await client.fetchComments(42)

      expect(comments).toEqual([
        { id: 1, body: 'First comment' },
        { id: 2, body: 'Second comment' },
      ])
    })

    it('replaces a null comment body with an empty string', async () => {
      mockListComments.mockResolvedValue({
        data: [{ id: 1, body: null }],
      })

      const comments = await client.fetchComments(42)

      expect(comments).toEqual([{ id: 1, body: '' }])
    })
  })
})
