import { afterEach, describe, expect, it, vi } from 'vitest';
import { CheckThatPhone, CheckThatPhoneError } from '../src/index';

function mockFetchOnce(status: number, body: unknown) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('CheckThatPhone.lookup', () => {
  it('sends the phone and flags, returns typed envelope', async () => {
    const fn = mockFetchOnce(200, {
      success: true,
      credits_used: 2,
      data: { subscriber: '8182925409', nanpType: 'mobile', litigator: 'false' },
    });
    const client = new CheckThatPhone('ctp_live_test');
    const res = await client.lookup('(818) 292-5409', { litigatorFilter: true, dncState: true, dncComplainer: true });

    expect(res.success).toBe(true);
    expect(res.creditsUsed).toBe(2);
    expect(res.data.nanpType).toBe('mobile');

    const [url, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.checkthatphone.com/v1/lookup');
    const sent = JSON.parse(String(init.body));
    expect(sent).toEqual({ phone: '(818) 292-5409', litigatorFilter: true, dncState: true, dncComplainer: true });
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer ctp_live_test');
  });

  it('translates the deprecated dncOther flag into dncState + dncComplainer on the wire', async () => {
    const fn = mockFetchOnce(200, { success: true, credits_used: 1, data: {} });
    await new CheckThatPhone('k').lookup('8182925409', { dncOther: true });
    const sent = JSON.parse(String((fn.mock.calls[0] as [string, RequestInit])[1].body));
    expect(sent).toEqual({ phone: '8182925409', dncState: true, dncComplainer: true });
  });

  it('sends only the DNC check that was asked for', async () => {
    const fn = mockFetchOnce(200, { success: true, credits_used: 1, data: {} });
    await new CheckThatPhone('k').lookup('8182925409', { dncComplainer: true });
    const sent = JSON.parse(String((fn.mock.calls[0] as [string, RequestInit])[1].body));
    expect(sent).toEqual({ phone: '8182925409', dncComplainer: true });
  });

  it('throws a typed error with status and detail on 4xx', async () => {
    mockFetchOnce(400, { error: 'Invalid request', detail: 'phone must be 10-11 digits' });
    const client = new CheckThatPhone('k');
    const err = await client.lookup('123').catch((e) => e);
    expect(err).toBeInstanceOf(CheckThatPhoneError);
    expect(err.status).toBe(400);
    expect(err.detail).toContain('10-11 digits');
    expect(err.retryable).toBe(false);
  });

  it('marks 429 and 5xx as retryable', async () => {
    mockFetchOnce(429, { error: 'Rate limited' });
    const err = await new CheckThatPhone('k').lookup('8182925409').catch((e) => e);
    expect(err.retryable).toBe(true);
  });

  it('requires an api key', () => {
    expect(() => new CheckThatPhone('')).toThrow(/apiKey/);
  });
});
