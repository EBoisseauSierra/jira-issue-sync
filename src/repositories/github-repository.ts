import * as github from '@actions/github'

export interface GitHubComment {
  id: number
  body: string
}

export interface GitHubRepository {
  postComment: (issueNumber: number, body: string) => Promise<void>
  fetchComments: (issueNumber: number) => Promise<GitHubComment[]>
}

export function createGitHubRepository(githubToken: string): GitHubRepository {
  const octokit = github.getOctokit(githubToken)
  const { owner, repo } = github.context.repo

  async function postComment(issueNumber: number, body: string): Promise<void> {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    })
  }

  async function fetchComments(issueNumber: number): Promise<GitHubComment[]> {
    const response = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
    })
    return response.data.map((comment) => ({
      id: comment.id,
      body: comment.body ?? '',
    }))
  }

  return { postComment, fetchComments }
}
