/**
 * Official Node.js client for the CheckThatPhone API.
 * https://checkthatphone.com/docs
 *
 * Zero runtime dependencies — uses the global fetch available in Node 18+.
 */

export interface LookupOptions {
  /** IPv4/IPv6 of the number's owner — enables precise GeoIP + timezone. */
  ip?: string;
  /** TCPA litigator scrub (+1 credit). Adds litigator, litigator_type, litigator_name. */
  litigatorFilter?: boolean;
  /** Landline SMS reachability (+1 credit, landlines only). Adds dipMessaging* fields. */
  landlineSmsLookup?: boolean;
  /** State DNC & complainers scrub (free). Adds dncOtherChecked, dncStateResult,
   *  dncComplainerResult, dncStateCovered. */
  dncOther?: boolean;
}

/**
 * Fields returned by the API. All values are strings unless noted — the API
 * uses string booleans ("true"/"false"). Add-on fields are present only when
 * the matching flag was sent (and, for dipMessaging*, when the number is a
 * landline). See https://checkthatphone.com/docs for the full field reference.
 */
export interface LookupData {
  subscriber?: string;
  optDate?: string;
  action?: string;
  deliverable?: string;
  reason?: string;
  nanpType?: string;
  blackList?: string;
  smsEligible?: string;
  doNotSms?: string;
  deactivationDate?: string;
  ipResult?: string;
  dip?: string;
  dipLrn?: string;
  dipPorted?: string;
  dipOcn?: string;
  dipCarrier?: string;
  dipCarrierSubType?: string;
  dipCarrierType?: string;
  geoCountry?: string;
  geoState?: string;
  geoCity?: string;
  geoMetro?: number;
  geoSource?: string;
  timezone?: string;
  tzOffset?: number;
  litigator?: string;
  litigator_type?: string;
  litigator_name?: string;
  dipMessagingLookup?: string;
  dipMessagingEnabled?: string;
  dipMessagingProvider?: string;
  dipMessagingRefId?: string;
  dipMessagingCountryCode?: string;
  dncOtherChecked?: string;
  dncStateResult?: string;
  dncComplainerResult?: string;
  dncStateCovered?: string;
  [key: string]: unknown;
}

export interface LookupResponse {
  success: boolean;
  /** Credits this call drew from your plan (0 on failures). */
  creditsUsed: number;
  data: LookupData;
}

export interface ClientOptions {
  /** Override the API base URL. You almost never need this. */
  baseUrl?: string;
  /** Request timeout in milliseconds (default 15000). */
  timeoutMs?: number;
}

/** Error raised for non-2xx API responses. */
export class CheckThatPhoneError extends Error {
  /** HTTP status (400 invalid input, 401 bad key, 402 quota, 429 rate limit, 502 upstream). */
  readonly status: number;
  /** Machine-readable error string from the API. */
  readonly code: string;
  /** Human-readable detail, when the API provides one. */
  readonly detail?: string;

  constructor(status: number, code: string, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'CheckThatPhoneError';
    this.status = status;
    this.code = code;
    this.detail = detail;
  }

  /** True for errors where retrying the identical request may succeed. */
  get retryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

export class CheckThatPhone {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(apiKey: string, options: ClientOptions = {}) {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('CheckThatPhone: apiKey is required — create one at https://checkthatphone.com/dashboard/keys');
    }
    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl ?? 'https://api.checkthatphone.com').replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 15000;
  }

  /**
   * Validate one US/Canada phone number.
   *
   * @param phone 10-digit number (11-digit with leading 1 also accepted);
   *              non-digits are ignored, so "(818) 292-5409" is fine.
   */
  async lookup(phone: string, options: LookupOptions = {}): Promise<LookupResponse> {
    const body: Record<string, unknown> = { phone };
    if (options.ip) body.ip = options.ip;
    if (options.litigatorFilter) body.litigatorFilter = true;
    if (options.landlineSmsLookup) body.landlineSmsLookup = true;
    if (options.dncOther) body.dncOther = true;

    const res = await fetch(`${this.baseUrl}/v1/lookup`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
        'user-agent': `checkthatphone-node/${VERSION}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok) {
      throw new CheckThatPhoneError(
        res.status,
        typeof payload.error === 'string' ? payload.error : `HTTP ${res.status}`,
        typeof payload.detail === 'string' ? payload.detail : undefined
      );
    }

    return {
      success: payload.success === true,
      creditsUsed: typeof payload.credits_used === 'number' ? payload.credits_used : 0,
      data: (payload.data ?? {}) as LookupData,
    };
  }
}

export const VERSION = '0.1.0';

export default CheckThatPhone;
