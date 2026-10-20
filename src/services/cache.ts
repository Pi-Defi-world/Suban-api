import NodeCache from 'node-cache';
import { config } from '../config';
import { cacheEvents } from './metrics';

export const cache = new NodeCache({
  stdTTL: config.cacheTTL,
  checkperiod: config.cacheTTL * 0.2,
});

export function getCached<T>(key: string): T | undefined {
  const value = cache.get<T>(key);
  cacheEvents.inc({ result: value === undefined ? 'miss' : 'hit' });
  return value;
}

export function setCache(key: string, data: any, ttl?: number): void {
  cache.set(key, data, ttl || config.cacheTTL);
  cacheEvents.inc({ result: 'set' });
}
