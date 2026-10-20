import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { horizonDuration, horizonRequests } from './metrics';

const client = axios.create({
  baseURL: config.horizonUrl,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

export async function proxyToHorizon(path: string, method: string = 'GET', params?: any, body?: any): Promise<any> {
  const start = process.hrtime.bigint();
  const normalizedMethod = method.toUpperCase();
  try {
    const response = await client({
      method: method.toLowerCase() as any,
      url: path,
      params,
      data: body,
    });
    horizonRequests.inc({ method: normalizedMethod, status: String(response.status) });
    horizonDuration.observe(
      { method: normalizedMethod, status: String(response.status) },
      Number(process.hrtime.bigint() - start) / 1e9
    );
    return response.data;
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message = error.response?.data || error.message;
    horizonRequests.inc({ method: normalizedMethod, status: String(status) });
    horizonDuration.observe(
      { method: normalizedMethod, status: String(status) },
      Number(process.hrtime.bigint() - start) / 1e9
    );
    logger.error('Horizon proxy error', { path, status, message });
    throw { status, message };
  }
}
