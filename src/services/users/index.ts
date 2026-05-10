import { callOperation } from '../../core/client.js';
import { withCache } from '../cache.js';

export interface MeProfile {
  id: number;
  username: string;
  email: string;
}

interface MeResponse {
  data: MeProfile;
}

export async function getMe(): Promise<MeProfile> {
  return withCache('me', undefined, async () => {
    const result = await callOperation({ operationId: 'get_soundiiz_openapi_v1_merest_getme' });
    const payload = result.data as MeResponse;
    return payload.data;
  });
}
