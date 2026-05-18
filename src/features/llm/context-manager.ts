import type { ChatMessage, LLMProvider } from "./types";

export function trimMessagesToFit(
  messages: ChatMessage[],
  maxTokens: number,
  provider: LLMProvider,
  model: string,
  reserveForResponse: number = 2000
): ChatMessage[] {
  const available = maxTokens - reserveForResponse;

  const systemMessage = messages.find((message) => message.role === "system");
  const lastUserMessage = messages
    .filter((message) => message.role === "user")
    .pop();

  let tokenCount = 0;
  if (systemMessage) {
    tokenCount += provider.countTokens(systemMessage.content, model);
  }
  if (lastUserMessage) {
    tokenCount += provider.countTokens(lastUserMessage.content, model);
  }

  const history = messages
    .filter((message) => message !== systemMessage && message !== lastUserMessage)
    .reverse();

  const included: ChatMessage[] = [];
  for (const message of history) {
    const messageTokens = provider.countTokens(message.content, model);
    if (tokenCount + messageTokens > available) {
      break;
    }
    included.unshift(message);
    tokenCount += messageTokens;
  }

  const result: ChatMessage[] = [];
  if (systemMessage) {
    result.push(systemMessage);
  }
  result.push(...included);
  if (lastUserMessage) {
    result.push(lastUserMessage);
  }

  return result;
}
