import { MAX_RETRY_ATTEMPTS, retryDelay } from './retry-backoff'
import { loadMessages, removeMessage, saveMessage, type PersistedMessage } from './upload-idb'

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export function newClientMessageId() {
  return crypto.randomUUID()
}

export async function persistOutgoingMessage(input: {
  clientMessageId: string
  eventId: string
  message: string
}) {
  const now = Date.now()
  const row: PersistedMessage = {
    clientMessageId: input.clientMessageId,
    eventId: input.eventId,
    message: input.message,
    status: 'queued',
    attemptCount: 0,
    createdAt: now,
    updatedAt: now,
    error: null,
  }
  await saveMessage(row)
  return row
}

export async function sendQueuedMessage(
  row: PersistedMessage,
  send: (input: { clientMessageId: string; message: string }) => Promise<unknown>,
  wait: (attempt: number) => Promise<void> = (attempt) => sleep(retryDelay(attempt)),
) {
  let attempt = row.attemptCount
  let current: PersistedMessage = { ...row, status: 'sending', updatedAt: Date.now() }
  await saveMessage(current)
  while (attempt < MAX_RETRY_ATTEMPTS) {
    try {
      await send({ clientMessageId: current.clientMessageId, message: current.message })
      current = { ...current, status: 'sent', error: null, updatedAt: Date.now() }
      await removeMessage(current.clientMessageId)
      return current
    } catch (error) {
      attempt += 1
      const message = error instanceof Error ? error.message : 'FAILED'
      current = {
        ...current,
        status: attempt >= MAX_RETRY_ATTEMPTS ? 'failed' : 'retrying',
        attemptCount: attempt,
        error: message,
        updatedAt: Date.now(),
      }
      await saveMessage(current)
      if (attempt >= MAX_RETRY_ATTEMPTS) return current
      await wait(attempt - 1)
    }
  }
  return current
}

export async function resumeQueuedMessages(
  send: (input: { clientMessageId: string; message: string }) => Promise<unknown>,
) {
  const rows = await loadMessages()
  const pending = rows.filter((row) => row.status !== 'sent')
  const results = []
  for (const row of pending) {
    results.push(await sendQueuedMessage(row, send))
  }
  return results
}
