export type Provider = 'chatgpt' | 'gemini' | 'unknown';

export interface ChatMessage {
  platform: Provider;
  conversationId: string;
  conversationTitle?: string;
  nativeMessageId?: string;
  messageKey: string;
  role: 'user' | 'assistant' | 'system' | 'unknown';
  content: string;
  contentHash: string;
  createdAt?: string;
  exportedAt: string;
}

export interface Checkpoint {
  platform: Provider;
  conversationId: string;
  lastExportedAt: string;
  lastSeenMessageKey?: string;
  messageCount: number;
  tailHashes: string[];
}
