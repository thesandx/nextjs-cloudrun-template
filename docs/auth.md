# Authentication

How a person signs in, how the server knows who they are, and what to do when it fails.

The decision and its alternatives are in [ADR-0005](./adr/0005-use-firebase-auth-for-sign-in.md). This page is the practical guide.

---

## What you get

Two ways to sign in, both through Firebase Auth:

| Method    | Good for                                  | Costs                                                              |
| --------- | ----------------------------------------- | ------------------------------------------------------------------ |
| Google    | Desktop, and anyone with a Google account | Free                                                               |
| Phone OTP | Mobile, and the default login in India    | Real money per SMS — read [SMS fraud](#sms-fraud-is-the-real-risk) |

Reads are public. Writes need a session. Nothing else changes.

---

## The flow

```
1. Browser signs in with Firebase        → an ID token, valid one hour
2. POST /api/auth/session { idToken }    → server verifies it
3. Server sets an httpOnly cookie        → a session, valid up to 14 days
4. Every later request carries it        → getCurrentUser() on the server
```

**Step 2 happens once.** The ID token is spent and discarded. It is never put in `localStorage`, and the session cookie is `httpOnly`, so page script cannot read either one. A session that script can read is a session an XSS can steal.

**Why a session cookie and not the ID token.** An ID token expires after an hour. Storing it means any page loaded after that renders signed-out until the client notices and posts a fresh one. A session cookie removes that whole class of flicker. It costs one IAM role — see [The one broad role](#the-one-broad-role).

---

## Using it

### On the server

```ts
import { getCurrentUser, requireUser } from '@/services/auth.service';

// A page that adapts to who is asking. `null` when signed out.
const user = await getCurrentUser();

// A route that requires a session. Throws UnauthenticatedError, which
// lib/http-errors.ts maps to 401 — no special case in the handler.
const user = await requireUser();
```

That is the whole gate. One line per protected route.

`getCurrentUser` reads cookies, so any page that calls it is rendered on demand. That is correct for content that depends on the reader, but it does mean the page is never static.

### Ownership

A session says **who**, not **what they may touch**. Those are different checks, and only the first is automatic:

```ts
const document = await examples.getOrThrow(id);
if (document.ownerId !== user.uid) throw new ForbiddenError();
```

Write `ownerId` from the session, never from the request body. A body field named `ownerId` is a field the caller chooses.

### On the client

```tsx
import { SignInPanel } from '@/components/auth/SignInPanel';
import { SignOutButton } from '@/components/auth/SignOutButton';
```

`hooks/useFirebaseAuth.ts` holds the SDK calls. Nothing else should import `firebase/auth` directly.

### The sign-in screen

`/sign-in` behaves like a native app screen. It has an on-screen back arrow, so the user does not need the browser's back button. The phone flow has two steps on one route:

1. **Phone number.** The country code is a separate, prefilled choice. The user types only the national number. `lib/phone.ts` joins the two into E.164 and checks the digit count before any SMS is sent.
2. **OTP.** The screen shows the number the OTP went to. Six digits verify at once. "Resend OTP" unlocks after 30 seconds, because each SMS costs money.

The back arrow on the OTP step returns to the phone step and keeps the number, so the user can correct it.

To change the prefilled country, edit `DEFAULT_DIAL_COUNTRY` in `lib/phone.ts`. Keep `DIAL_COUNTRIES` the same as the SMS region policy in the console. A country that the policy blocks fails only after the user types the number.

Hiding a form from a signed-out user is a courtesy, not a control. The control is `requireUser()` on the server.

---

## Profiles

`users/{uid}` — the app's own record of a person, separate from Firebase Auth, which remains the source of truth for identity.

The document id is the Firebase uid, so a profile is one key lookup from any authenticated request. No query, no index, no second read.

```ts
const profile = await requireUserProfile(user);
```

It is created at sign-in, inside a transaction, because two requests from the same new user can arrive together.

**Why this is allowed to supply its own id.** The rule "never pass your own document id" exists to stop monotonic ids. A monotonic id sends every write to one end of the key range, and Firestore scales by splitting that range. A Firebase uid is 28 characters of random base62, so it spreads exactly like an auto id. The rule's reason permits it.

`repository.createWithId()` is the exception, and `lib/document-ids.ts` keeps it narrow: it rejects sequential ids, date prefixes, bare numbers and anything too short to be random.

### What the user edits

`/profile` lets a signed-in user edit `displayName`, `dateOfBirth` and `gender`. The form sends `PATCH /api/profile`.

- The route takes the uid from the session. The body has no uid, so a user can only edit their own profile.
- `lib/profile-fields.ts` holds the rules. The form and the route use the same schema.
- `dateOfBirth` is a `YYYY-MM-DD` string, not a `Date`. A birthday is a calendar day, not an instant, and a `Date` moves it by a day in some time zones.
- `dateOfBirth` and `gender` are optional in the schema permanently. Profiles from before these fields have no value, and only the user can supply one. There is nothing to backfill.
- `null` clears a field.
- Phone and email come from sign-in. The user cannot edit them here.

### Erasure

Deleting one half leaves the account able to sign in and recreate an empty profile. Both are required:

```ts
await deleteUserProfile(uid); // the Firestore document
await getFirebaseAuth().deleteUser(uid); // the Firebase Auth account
```

### PII

`email`, `phoneNumber` and `dateOfBirth` identify a person. `gender` is sensitive. A `uid` does not identify a person. Application logs go to Cloud Logging, where they are retained and widely readable, so **only the uid is ever logged**. Nothing in `services/auth.service.ts` or `services/user.service.ts` logs an address, a number, a birth date or a gender. A profile update logs the names of the changed fields, never their values. Keep it that way.

---

## Setup

Four steps have no gcloud surface, so `gcp-bootstrap.sh` prints them rather than pretending to do them.

1. **Add Firebase to the GCP project.** It stays the same project.
2. **Register a web app.** Copy `apiKey`, `authDomain` and `appId`.
3. **Enable Google and Phone** under Authentication > Sign-in method.
4. **Set the SMS region policy.** See below. Do not skip it.

Then set four repository variables:

```bash
gh variable set FIREBASE_API_KEY     --body "AIza..."
gh variable set FIREBASE_AUTH_DOMAIN --body "my-project.firebaseapp.com"
gh variable set FIREBASE_PROJECT_ID  --body "my-project"
gh variable set FIREBASE_APP_ID      --body "1:...:web:..."
```

Add every origin the app is served from to **Authorized domains**, including the `*.run.app` URL. Google sign-in is refused from an origin that is not listed.

### The API key is not a secret

The browser must send it to reach Identity Platform, so it ships in every bundle. It names the project; it authorises nothing. Restrict it by HTTP referrer in the Google Cloud console under APIs & Services > Credentials.

Putting it in a GitHub **secret** achieves nothing and makes it harder to debug. It is a **variable**.

### These are build-time values

`NEXT_PUBLIC_*` is inlined into the JavaScript at build time. Setting one on the Cloud Run service changes nothing — the value is already inside the code users downloaded. **Rebuild the image.** This is trap 8, and it catches everyone once.

### Leaving it unconfigured is safe

An app built with no Firebase config serves public reads and answers 401 to every write. `authEnabled` in `lib/env.ts` is derived from the config being complete, not from a flag, so a half-finished setup can never become an open endpoint.

---

## SMS fraud is the real risk

Phone auth sends a message that **you pay for**. An open send endpoint is the target of SMS pumping fraud: an attacker sends codes to premium-rate numbers they collect revenue from, and the bill is yours. It is automated, and it finds new endpoints quickly.

Three controls, in order of how much they matter:

1. **SMS region policy.** Authentication > Settings > SMS region policy. Allow only the countries you serve. The default allows every country on earth, and the fraud lives in the ones you do not sell to. This is the single most effective control.
2. **reCAPTCHA.** Already wired: `useFirebaseAuth` creates an invisible verifier, which is mandatory for phone auth. It solves itself for nearly every real user.
3. **A budget alert.** It will not stop an attack, but it is how you find out in hours rather than at the end of the month. `gcp-bootstrap.sh` prints the command.

Firebase also applies its own per-number and per-IP limits. Do not rely on them alone.

---

## The one broad role

The runtime service account holds `roles/firebaseauth.admin`. It is the broadest role that identity has, and it is deliberate rather than overlooked.

Minting a session cookie calls the Identity Toolkit API, which needs a role on the project. There is no narrower predefined role that can do it. The role can also create, disable and delete users.

**Verifying a session needs no IAM at all** — it checks a signature against Google's published public keys. So a missing or broken grant has a distinctive symptom: existing sessions keep working, and only new sign-ins fail, with `PERMISSION_DENIED` from `identitytoolkit`. That looks like a client bug and is not one.

Narrow it with a custom role if your threat model needs it. Read that symptom first, so you recognise it when it appears.

---

## Local development

Sign-in talks to real Firebase even on a laptop. The Firestore emulator does not cover Auth in this template.

```bash
# .env.local
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=my-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=my-project
NEXT_PUBLIC_FIREBASE_APP_ID=1:...:web:...
```

Add `localhost` to Authorized domains in the console.

The session cookie is `Secure` everywhere except plain-HTTP localhost, where a browser refuses to store a Secure cookie. That carve-out is derived from `NEXT_PUBLIC_APP_URL`, not from the request, so a forged `X-Forwarded-Proto` header cannot downgrade it in production.

---

## Settings

| Variable                    | Default | What it does                                        |
| --------------------------- | ------- | --------------------------------------------------- |
| `AUTH_SESSION_MAX_AGE_DAYS` | `14`    | Session lifetime. Firebase caps it at 14.           |
| `AUTH_CHECK_REVOKED`        | `false` | Check every request against revoked refresh tokens. |

`AUTH_CHECK_REVOKED` costs one call to Identity Platform on **every** authenticated request — a per-request dependency on an external service in the hot path. On, "sign out everywhere" takes effect immediately. Turn it on for an app handling money or health data; leave it off for most.

---

## What to do when something fails

| Symptom                                                     | Cause                                                                  |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| Sign-in works, then the user is signed out on the next page | The cookie is not named `__session`, and Hosting stripped it           |
| New sign-ins fail, existing sessions keep working           | The runtime account is missing `roles/firebaseauth.admin`              |
| `auth/unauthorized-domain`                                  | The origin is not in Authentication > Settings > Authorized domains    |
| `auth/operation-not-allowed`                                | That provider is not enabled in the console                            |
| The sign-in panel says "not configured"                     | The web config is missing from the **build**. Rebuild, do not restart  |
| `auth/invalid-app-credential` on phone sign-in              | reCAPTCHA could not load, or the domain is not authorised              |
| An unexpected SMS bill                                      | The SMS region policy is still the default. Restrict it now            |
| 401 from a write route with a user clearly signed in        | The cookie did not reach the server. Check `Secure` against the scheme |

The full table is in [troubleshooting.md](./troubleshooting.md).
