# ADR-0005: Use Firebase Auth for sign-in, with server-side session cookies

- **Status:** Accepted
- **Date:** 2026-09-23
- **Deciders:** template maintainers

## Context

The template shipped no authentication. Every route was anonymous, and the example feature showed what that costs: `POST /api/example` created documents and `POST /api/example/upload` handed out signed upload URLs to any caller who found the URL. Nothing rate-limited either one. A signed URL is a bearer credential to write into the bucket, so the template's default state was an open write endpoint on a public address.

Every application generated from this template needs sign-in. Without a decision here, each one invents its own, and the isolation guarantees of [ADR-0004](./0004-use-firestore-and-cloud-storage.md) stop meaning anything — a data layer scoped to one app is not a control if anybody can write to it.

The constraints:

- **No long-lived credentials may exist.** [ADR-0002](./0002-use-workload-identity-federation.md) removed service account keys. An auth provider needing a key file reintroduces the shape of the problem it solved.
- **Server Components render first.** Identity must be known on the server, on the first render, or every protected page flashes signed-out content before correcting itself.
- **The primary market is B2C in India.** Phone OTP is the dominant login method there. Email and password is not competitive.
- **Cloud Run scales to zero.** Anything holding server-side session state in memory is wrong: the instance that minted a session is usually not the instance that reads it.
- **Firestore rules deny all client access,** and that must stay true. Opening them moves authorisation out of route handlers and into a rules file, permanently.

## Decision

We will use **Firebase Auth**, with **Google** and **phone OTP** enabled, and exchange its ID token for a **server-side session cookie**.

- The browser signs in with the Firebase client SDK and receives an ID token.
- It posts that token once to `POST /api/auth/session`. The server verifies it with `checkRevoked`, mints a session cookie of up to 14 days, and sets it `httpOnly`, `Secure` and `SameSite=Lax`.
- The cookie is named `__session`, because Firebase Hosting and the CDN in front of it strip every other cookie.
- Reads stay public. Writes call `requireUser()`.
- A profile lives at `users/{uid}`, keyed by the Firebase uid.
- **Nothing ships the Firestore client SDK to the browser.** All data access stays server-side, and `firestore.rules` stays deny-all.

Sign-in availability is **derived** from the web config being complete, not set by a flag. An application built without Firebase configuration serves public reads and answers 401 to every write.

## Alternatives considered

**Auth.js (NextAuth).** Framework-native and provider-agnostic. Rejected on phone OTP: it has no first-class SMS flow, so we would have integrated an SMS gateway, written the code storage, the expiry and the rate limiting ourselves, and owned the fraud surface. That is the hardest part of the feature, and Firebase has already solved it.

**Identity Platform directly, without Firebase.** The same service underneath, and what the Admin SDK actually calls. Rejected because the client SDKs, the console for enabling providers, and the reCAPTCHA integration are all on the Firebase side. Using the lower layer means rebuilding the upper one.

**Storing the ID token in the cookie instead of minting a session.** Tempting: it needs **no IAM permission at all**, since verification only checks a signature against Google's public keys. Rejected because an ID token expires after an hour, so any page loaded after that renders signed-out until the client posts a fresh one. We chose one IAM role over a permanent class of UI flicker.

**Client-side auth state only, with the Firestore client SDK.** The conventional Firebase web architecture. Rejected outright: it moves authorisation into `firestore.rules`, contradicts ADR-0004's server-only data layer, and ships the SDK and the intent to use credentials to the browser.

**A self-hosted provider (Keycloak, Ory, Zitadel).** Full control, no vendor. Rejected on operational cost: it is a stateful service to run, back up and patch, next to an application whose entire premise is scaling to zero.

## Consequences

**Good**

- Sign-in needs no key file. The Admin SDK uses Application Default Credentials, consistent with every other Google service in the template.
- The server knows the user on the first render. No flash, no client round trip, no loading state on a protected page.
- Phone OTP, reCAPTCHA, provider account linking and token revocation are all provided.
- The write hole is closed, and closed by default: an unconfigured deployment is read-only rather than open.

**Bad, and accepted**

- **The runtime service account holds `roles/firebaseauth.admin`.** Minting a session cookie requires a role on the project, and no narrower predefined role can do it. That role can also create, disable and delete users. It is the broadest privilege the runtime identity has. Verifying a session needs no IAM, so a missing grant fails only new sign-ins — a symptom documented in [docs/auth.md](../auth.md) because it looks like a client bug.
- **Phone OTP costs money per message,** and an open send endpoint invites SMS pumping fraud. This is mitigated by the SMS region policy, reCAPTCHA and a budget alert, and none of those is automatic. `gcp-bootstrap.sh` prints all three.
- **Four setup steps cannot be scripted.** Registering a web app and enabling a provider have no gcloud surface, so bootstrap prints instructions rather than performing them. Bootstrap is no longer sufficient on its own.
- **Two more SDKs.** `firebase` and `firebase-admin`, against [rule 8](../../.github/instructions/coding-rules.md). Verifying a Firebase JWT by hand means fetching and caching Google's keys, checking the algorithm, issuer, audience and expiry, and getting the session cookie format right — a security-critical reimplementation of a maintained library.
- **A profile document uses a caller-supplied id,** which the twelve rules otherwise forbid. The rule targets monotonic ids; a uid is random. `createWithId` and `lib/document-ids.ts` take the exception and keep it narrow.

## References

- [docs/auth.md](../auth.md) — the practical guide
- [ADR-0002](./0002-use-workload-identity-federation.md) — no service account keys
- [ADR-0004](./0004-use-firestore-and-cloud-storage.md) — the server-only data layer this protects
- [Firebase Hosting cookie handling](https://firebase.google.com/docs/hosting/manage-cache#using_cookies) — why the cookie is named `__session`
