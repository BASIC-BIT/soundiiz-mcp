export interface TextContent {
  type: 'text';
  text: string;
}

export function textContent(text: string): TextContent[] {
  return [{ type: 'text', text }];
}

export function toolJson(payload: unknown): { content: TextContent[] } {
  return { content: textContent(JSON.stringify(payload, null, 2)) };
}

export function toolError(message: string, payload?: Record<string, unknown>) {
  const body = payload ?? { error: message };
  const text = payload ? JSON.stringify(body, null, 2) : message;
  return {
    isError: true,
    content: textContent(text),
  };
}
