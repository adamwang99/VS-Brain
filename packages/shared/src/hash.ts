import { createHash } from 'node:crypto';
import { normalizeContent } from './normalize.js';

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function contentHash(content: string): string {
  return sha256(normalizeContent(content));
}
