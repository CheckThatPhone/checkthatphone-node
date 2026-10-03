# checkthatphone

[![npm version](https://img.shields.io/npm/v/checkthatphone)](https://www.npmjs.com/package/checkthatphone) [![CI](https://github.com/CheckThatPhone/checkthatphone-node/actions/workflows/ci.yml/badge.svg)](https://github.com/CheckThatPhone/checkthatphone-node/actions/workflows/ci.yml) [![node >= 18](https://img.shields.io/node/v/checkthatphone)](https://www.npmjs.com/package/checkthatphone)

Official Node.js client for the [CheckThatPhone](https://checkthatphone.com) phone validation API. Validate US and Canadian phone numbers in real time: carrier and line type from live carrier data, portability and deliverability, GeoIP and timezone, plus optional TCPA litigator screening and free state do-not-call and complainer scrubs — one call, one credit.

Zero dependencies. Node 18+. TypeScript types included.

## Install

```bash
npm install checkthatphone
```

## Quick start

```js
import CheckThatPhone from 'checkthatphone';

const client = new CheckThatPhone(process.env.CHECKTHATPHONE_API_KEY);

const result = await client.lookup('8182925409');
console.log(result.data.nanpType);      // "mobile"
console.log(result.data.dipCarrier);    // "AT&T"
console.log(result.data.deliverable);   // "true"
console.log(result.creditsUsed);        // 1
```

Get an API key at [checkthatphone.com](https://checkthatphone.com) — the free tier includes 500 lookups per month.

## TCPA litigator screening

Flag known serial TCPA plaintiffs before you call or text (+1 credit):

```js
const result = await client.lookup('8182925409', { litigatorFilter: true });
if (result.data.litigator === 'true') {
  // result.data.litigator_type: "litigator" | "plaintiff" | "agitator"
  // result.data.litigator_name: name on record
  suppress(result.data.subscriber);
}
```

## State DNC and complainer scrub (free)

Screen state do-not-call registries (38 states plus DC) and a national complainer list at no extra credit. Each check is its own flag:

```js
const result = await client.lookup('8182925409', { dncState: true, dncComplainer: true });
result.data.dncStateChecked;     // "true" when the state check ran; absent for the 12 states with no registry data
result.data.dncStateResult;      // "STATE DNC" on a match, "" otherwise (only when dncStateChecked is "true")
result.data.dncComplainerChecked; // "true" when the complainer check ran
result.data.dncComplainerResult; // "DNC COMPLAINER" on a match, "" otherwise
```

Read `dncStateChecked` before `dncStateResult`: a number in an uncovered state comes back with neither field, which means not checked, not clear. `"error"` means the check could not complete; treat it as unavailable.

`dncOther: true` still works as a shorthand for both checks, but it is deprecated.

## Landline SMS reachability

Some landlines can receive texts. Detect them instead of dropping them (+1 credit, charged only when the number is a landline):

```js
const result = await client.lookup('5551234567', { landlineSmsLookup: true });
if (result.data.dipMessagingEnabled === 'true') sendSms(...);
```

## GeoIP and timezone

Pass the contact's IP for city-level location and the IANA timezone (no extra charge) — useful for TCPA calling-hours compliance:

```js
const result = await client.lookup('8182925409', { ip: '136.38.145.14' });
result.data.timezone; // "America/Los_Angeles"
```

## Errors

Non-2xx responses throw `CheckThatPhoneError` with `status`, `code`, `detail`, and a `retryable` hint. Failed and invalid requests are billed 0 credits.

```js
import { CheckThatPhoneError } from 'checkthatphone';

try {
  await client.lookup('not-a-number');
} catch (err) {
  if (err instanceof CheckThatPhoneError && err.retryable) retryLater();
}
```

## Full field reference

Every response field (carrier DIP, portability/LRN, deactivation, blacklist, and more) is documented at [checkthatphone.com/docs](https://checkthatphone.com/docs).

## License

MIT
