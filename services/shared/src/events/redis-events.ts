/**
 * Redis Pub/Sub channel names used for inter-service communication.
 * Chat Service  →  ai.process   →  AI Service
 * AI Service    →  ai.response  →  Chat Service
 * AI Service    →  memory.save  →  Memory Service
 */
export const REDIS_CHANNELS = {
  AI_PROCESS:    'soulsync:ai:process',
  AI_RESPONSE:   'soulsync:ai:response',
  MEMORY_SAVE:   'soulsync:memory:save',
  MEMORY_SEARCH: 'soulsync:memory:search',
} as const;

export const REDIS_KEYS = {
  shortTerm: (userId: string) => `soulsync:st:${userId}`,
} as const;
