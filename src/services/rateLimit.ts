import { getConfig } from '../config/index.js';

class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private refillPerMs: number;
  private capacity: number;

  constructor(perMinute: number) {
    this.capacity = perMinute;
    this.tokens = perMinute;
    this.refillPerMs = perMinute / 60_000;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
      this.lastRefill = now;
    }
  }

  async take(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const need = 1 - this.tokens;
    const waitMs = Math.ceil(need / this.refillPerMs) + 5;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return this.take();
  }
}

let bucket: TokenBucket | null = null;

export async function awaitRateLimit(): Promise<void> {
  if (!bucket) {
    bucket = new TokenBucket(getConfig().rateLimit.perMinute);
  }
  await bucket.take();
}

export function resetRateLimitForTest(): void {
  bucket = null;
}
