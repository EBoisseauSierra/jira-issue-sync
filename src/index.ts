import * as core from '@actions/core'
import * as github from '@actions/github'
import { readActionInputs } from './inputs'
import { orchestrateIssueOpened } from './orchestrators/issue-opened'
import { orchestrateIssueClosed } from './orchestrators/issue-closed'

export async function run(): Promise<void> {
  const inputs = readActionInputs()
  const eventAction = github.context.payload.action
  // @actions/github types the payload loosely; we cast to any and let the
  // handler interfaces enforce the shape at the TypeScript level.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const issue = github.context.payload.issue as any

  if (!issue) {
    core.setFailed(
      'This action must be triggered by an issue event, but the payload contained no issue.',
    )
    return
  }

  if (eventAction === 'opened') {
    await orchestrateIssueOpened(issue, inputs)
  } else if (eventAction === 'closed') {
    await orchestrateIssueClosed(issue, inputs)
  } else {
    core.setFailed(
      `Unexpected issue event action: "${eventAction}". This action only handles "opened" and "closed" events.`,
    )
  }
}

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error))
})
