const MAILPIT_API = 'http://mailpit:8025/api/v1';

export interface MailpitMessage {
  Subject: string;
  Text: string;
}

async function searchMessagesTo(email: string): Promise<Array<{ ID: string }>> {
  const res = await fetch(
    `${MAILPIT_API}/search?query=to:${encodeURIComponent(email)}`,
  );
  const { messages } = (await res.json()) as {
    messages: Array<{ ID: string }>;
  };
  return messages;
}

async function findMessageTo(
  email: string,
): Promise<MailpitMessage | undefined> {
  const messages = await searchMessagesTo(email);
  if (messages.length === 0) return undefined;

  const detail = await fetch(`${MAILPIT_API}/message/${messages[0].ID}`);
  return (await detail.json()) as MailpitMessage;
}

/**
 * Polls Mailpit for the latest message sent to `email`, up to `timeoutMs`.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
export async function awaitMessageTo(
  email: string,
  timeoutMs = 2000,
  pollIntervalMs = 50,
): Promise<MailpitMessage | undefined> {
  const deadline = Date.now() + timeoutMs;
  do {
    const message = await findMessageTo(email);
    if (message) return message;
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  } while (Date.now() < deadline);
  return undefined;
}

/**
 * Polls Mailpit until at least `expectedCount` messages have been received
 * for `email`, up to `timeoutMs`.
 *
 * @author Saulo Santos
 * @date 11/07/2026
 */
export async function awaitMessageCountTo(
  email: string,
  expectedCount: number,
  timeoutMs = 2000,
  pollIntervalMs = 50,
): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let count = (await searchMessagesTo(email)).length;
  while (count < expectedCount && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    count = (await searchMessagesTo(email)).length;
  }
  return count;
}
