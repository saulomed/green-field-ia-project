import type { APIRequestContext } from "@playwright/test"

const MAILPIT_URL = process.env.MAILPIT_URL

interface MailpitMessage {
  Subject: string
  Text: string
}

async function searchMessagesTo(email: string): Promise<Array<{ ID: string }>> {
  const res = await fetch(
    `${MAILPIT_URL}/api/v1/search?query=to:${encodeURIComponent(email)}`,
  )
  const { messages } = (await res.json()) as { messages: Array<{ ID: string }> }
  return messages
}

async function findMessageTo(email: string): Promise<MailpitMessage | undefined> {
  const messages = await searchMessagesTo(email)
  if (messages.length === 0) return undefined

  const detail = await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`)
  return (await detail.json()) as MailpitMessage
}

/**
 * Polls Mailpit for the latest message sent to `email`, up to `timeoutMs`.
 * The frontend's own copy of `nestjs-project/test/support/mailpit.ts` — E2E
 * specs for `/signup` (account confirmation) and `/forgot-password`
 * (password reset) need the same capture mechanism on this side.
 */
export async function awaitMessageTo(
  email: string,
  timeoutMs = 5000,
  pollIntervalMs = 100,
): Promise<MailpitMessage | undefined> {
  const deadline = Date.now() + timeoutMs
  do {
    const message = await findMessageTo(email)
    if (message) return message
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  } while (Date.now() < deadline)
  return undefined
}

/**
 * Registers a fresh account, confirms it via the e-mail captured in Mailpit,
 * and logs in — seeding a real, cookie-backed session for tests that need
 * one already established. No screen in this phase requires a session
 * (§Authorization Matrix — `/signup`, `/login`, `/forgot-password` are all
 * anonymous), so nothing calls this yet; it exists for Fase 04's protected
 * surfaces per `auth-frontend/TD-05`.
 */
export async function seedConfirmedSession(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<void> {
  await request.post("/api/auth/register", { data: { email, password } })

  const message = await awaitMessageTo(email)
  if (!message) {
    throw new Error(`No confirmation e-mail captured for ${email}`)
  }

  const confirmationUrl = message.Text.match(/https?:\/\/\S+/)?.[0]
  if (!confirmationUrl) {
    throw new Error(`No confirmation link found in the e-mail for ${email}`)
  }
  await request.get(confirmationUrl)

  await request.post("/api/auth/login", { data: { email, password } })
}
