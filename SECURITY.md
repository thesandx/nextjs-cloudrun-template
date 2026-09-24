# Security policy

## Reporting a vulnerability

**Do not open a public issue.**

Use GitHub's private reporting: **Security** tab → **Report a vulnerability**. If that is unavailable, contact the repository owner directly.

Include what you found, how to reproduce it, and what an attacker can do with it. You get an acknowledgement within a few days, and an assessment soon after.

## Supported versions

This is a template. Security fixes land on `main`; there are no maintained release branches. Each project generated from it owns its dependency updates. Dependabot is preconfigured to help.

## Security model

### No long-lived credentials

The deployment pipeline authenticates through Workload Identity Federation. **No JSON service account key is created, stored or committed.** A key is a permanent bearer credential. An OIDC token lives for minutes.

Two controls bind that token, and they do different jobs:

- The provider's **attribute condition** names your GitHub owner. It stops every repository outside the owner.
- The deployer's **`principalSet://` binding** names this repository. It decides what the token can impersonate.

The binding is the one that authorises a deploy. The provider is shared by every repository in the project, so a per-repository condition there would break a sibling repository each time you add one. See [ADR-0003](./docs/adr/0003-scope-workload-identity-to-the-github-owner.md).

If you see `credentials_json:` or a `*.json` key anywhere in a project built from this template, that is a finding — report it.

See [ADR-0002](./docs/adr/0002-use-workload-identity-federation.md) and [`cloud/github-actions.md`](./cloud/github-actions.md).

### Identity separation

Two service accounts, deliberately distinct:

- **Deployer** — impersonated by CI. Can push images, deploy revisions, and publish Firestore indexes and rules. **Cannot read a single document or object.**
- **Runtime** — the identity the application runs as. Can use this app's database and this app's bucket, and read its own secrets. Cannot deploy, cannot modify IAM, cannot administer either resource.

If an attacker compromises either account, the damage stays contained.

### Data isolation

Several applications from this template usually share one GCP project. The isolation between them is IAM, not naming:

| Control                                                            | Where                      |
| ------------------------------------------------------------------ | -------------------------- |
| Named Firestore database per app, never `(default)`                | `scripts/gcp-bootstrap.sh` |
| `roles/datastore.user` under an IAM condition naming that database | `scripts/gcp-bootstrap.sh` |
| `roles/storage.objectUser` bound on the bucket, not the project    | `scripts/gcp-bootstrap.sh` |
| Deployer's `roles/datastore.indexAdmin` conditioned the same way   | `scripts/gcp-bootstrap.sh` |

**The condition is the control.** `roles/datastore.user` granted without one reaches **every** database in the project, so an unconditioned binding silently gives this app's identity read and write access to every other app's data. If you see that binding with no condition, that is a finding.

Firestore security rules (`firestore.rules`) deny all client access. They are defence in depth only: the application uses admin credentials, which bypass rules entirely.

### Storage hardening

| Control                                                          | Why                                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| Uniform bucket-level access                                      | Per-object ACLs are how a "private" bucket turns out to be readable |
| Public access prevention, enforced                               | Refuses a public grant outright, even a later `allUsers`            |
| Signed URLs only, short-lived                                    | No object is reachable without one                                  |
| V4 signing through IAM `signBlob`                                | No private key exists on disk; the account signs for itself         |
| Content-type allow-list, `image/svg+xml` excluded                | An inline SVG executes script — a writable bucket would host XSS    |
| Size ceiling signed into the URL (`x-goog-content-length-range`) | Makes the limit enforced by Cloud Storage, not advisory             |
| Uploads quarantined under `tmp/`, verified before promotion      | A signed URL constrains a well-behaved client, not a hostile one    |
| Lifecycle rule deletes `tmp/` after 1 day                        | Unverified objects do not accumulate                                |
| Soft delete, 7 days                                              | An accidental or malicious delete is recoverable                    |

### Data durability

| Control                        | Where                      |
| ------------------------------ | -------------------------- |
| Point-in-time recovery, 7 days | `scripts/gcp-bootstrap.sh` |
| Daily backups, 7-day retention | `scripts/gcp-bootstrap.sh` |
| Soft delete on every document  | `services/repository.ts`   |

PITR covers a mistake noticed within the hour. A backup schedule covers one noticed next week. They are not substitutes for each other.

### Container hardening

| Control                                                                         | Where                                         |
| ------------------------------------------------------------------------------- | --------------------------------------------- |
| Non-root user (uid 1001)                                                        | `Dockerfile`                                  |
| Minimal surface — no source, no dev deps, no package manager in the final image | `Dockerfile` (standalone output)              |
| Pinned base image versions                                                      | `Dockerfile` build args                       |
| Read-only root filesystem, `no-new-privileges`                                  | `docker-compose.yml`, `scripts/docker-run.sh` |
| Correct signal handling (`dumb-init`)                                           | `Dockerfile`                                  |

### Pipeline hardening

| Control                                                     | Where                           |
| ----------------------------------------------------------- | ------------------------------- |
| Least-privilege `permissions:` per workflow and job         | `.github/workflows/*`           |
| `persist-credentials: false` on checkout                    | all workflows                   |
| PR validation requires no cloud credentials                 | `pr-validation.yml`             |
| Provider pinned to your GitHub owner by attribute condition | Workload Identity provider      |
| Impersonation pinned to this repository                     | Deployer `principalSet` binding |
| CodeQL on PRs and weekly (needs code scanning — see below)  | `codeql.yml`                    |
| Dependabot on npm, Actions and Docker                       | `dependabot.yml`                |

### Authentication and authorisation

- Sign-in is **Firebase Auth** — Google and phone OTP. The browser's ID token is exchanged once for a server-side session cookie: `httpOnly`, `Secure`, `SameSite=Lax`, up to 14 days. Page script cannot read a session, so an XSS cannot steal one.
- The cookie is named `__session` because Firebase Hosting strips every other cookie. See trap 20 in `CLAUDE.md`.
- **Reads are public; every write requires a session.** `requireUser()` is the gate, and it is server-side. A form hidden in the UI is not a control.
- **A session is authentication, not authorisation.** Ownership is a separate, explicit check. Identity fields (`ownerId`, a display name) are always read from the session, never from a request body.
- Sign-in availability is **derived** from the Firebase web config being complete, not set by a flag. An app built without that config serves public reads and answers 401 to every write, so a half-finished setup fails closed rather than open.
- The runtime service account holds `roles/firebaseauth.admin`. This is the broadest privilege it has, and it is a deliberate trade-off: minting a session cookie needs a role on the project, and no narrower predefined role exists. Verifying a session needs no IAM at all. See [ADR-0005](./docs/adr/0005-use-firebase-auth-for-sign-in.md).
- **No Firebase data SDK reaches the browser.** Only `firebase/auth` is shipped. All data access stays server-side, and `firestore.rules` stays deny-all.
- Phone OTP is protected by an invisible reCAPTCHA, which Firebase requires. The SMS **region policy** is the control that matters against SMS pumping fraud, and it is not automatic — see the checklist below.
- A `uid` is pseudonymous and is logged. An email address and a phone number are not logged anywhere.

### Application

- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) set in `next.config.ts`; `X-Powered-By` removed.
- The app validates environment configuration at startup. A missing required variable fails the revision instead of serving broken responses.
- Secrets come from Secret Manager at runtime, never from build args (visible in `docker history`) and never from `NEXT_PUBLIC_*` (shipped to every browser).
- Every module in `services/` starts with `import 'server-only'`, so a Client Component importing the data layer is a build failure rather than an SDK in a browser bundle.
- Stored data is validated with zod on read as well as on write. A document written by an older build, a console edit or a half-finished migration raises a located error instead of flowing into a template as `undefined`.
- Route handlers return a caller's own validation errors and a generic 500 for anything else. A missing environment variable is never named to a client — see `lib/http-errors.ts`.
- Structured logs record a collection name, a document id and an object path. They never record file contents, personal data, or a signed URL — a signed URL is a bearer credential for as long as it lives.
- `/api/health` does not touch dependencies. Deep checks are behind `HEALTH_DEEP_CHECKS_ENABLED`, off by default, so the endpoint cannot be used to probe your infrastructure's latency.

## Hardening checklist for a real deployment

The template is a safe default, not a finished security posture. Before production:

- [ ] Narrow the deployer's `roles/run.admin` to `run.developer` or a custom role
- [ ] Restrict this repository to `refs/heads/main` — bootstrap with `--main-only`, which binds `attribute.repo_ref`. Do not add `assertion.ref` to the provider condition; it applies to every repository sharing the provider
- [ ] Add required reviewers to the `production` GitHub Environment
- [ ] Enable branch protection on `main`: required checks, required review, no force push
- [ ] Enable Artifact Registry vulnerability scanning
- [ ] Confirm CodeQL can upload results — code scanning is free on **public** repositories only. On a private repo without GitHub Advanced Security, the analysis runs and then fails at the upload step. Buy GHAS or delete `codeql.yml`. Do not leave a check permanently red.
- [ ] Set a billing budget with alerts — cost is a security control against runaway abuse
- [ ] Decide whether `--allow-unauthenticated` is correct; remove it for internal services
- [ ] Add rate limiting if any endpoint is expensive or writes data
- [ ] Grant the runtime service account only the roles the application uses
- [ ] Add a Content-Security-Policy once you know which origins the app legitimately loads from
- [ ] Confirm `roles/datastore.user` on the runtime account carries its IAM condition: `gcloud projects get-iam-policy PROJECT --format=json | jq '.bindings[] | select(.role=="roles/datastore.user")'`
- [ ] Confirm the bucket refuses public access: `gcloud storage buckets describe gs://BUCKET --format='value(public_access_prevention,uniform_bucket_level_access)'`
- [ ] Set the bucket's CORS origins to your real domains only — never `*`
- [ ] Review the content-type allow-list and size ceiling per upload path
- [ ] Decide whether 7-day backup retention and PITR meet your recovery objective
- [ ] Confirm `FIRESTORE_EMULATOR_HOST` is not set on any deployed service
- [ ] Set `RUNTIME_SERVICE_ACCOUNT` — without it Cloud Run runs as the default compute account, which is project Editor
- [ ] **Restrict the SMS region policy** to the countries you serve — Firebase console > Authentication > Settings. The default allows every country, and you pay per message. This is the main control against SMS pumping fraud
- [ ] Restrict the Firebase web API key by HTTP referrer — Google Cloud console > APIs & Services > Credentials. It is public by design, but it should only work from your origins
- [ ] List every origin the app is served from under Authentication > Settings > Authorized domains, including the `*.run.app` URL
- [ ] Confirm every route that writes calls `requireUser()`, and that each one checks ownership as well
- [ ] Decide whether `AUTH_CHECK_REVOKED` should be on — it makes "sign out everywhere" immediate, at one Identity Platform call per request
- [ ] Consider narrowing `roles/firebaseauth.admin` to a custom role with only the session-minting permission
- [ ] Delete the `/example` route, `services/example.service.ts` and `components/example/` once the pattern is copied — a demo write path on a public URL is still a write path

## What is out of scope

Findings in dependencies belong upstream — though we want to know if this repository pins a version with a known advisory. Vulnerabilities in Google Cloud itself go to [Google's VRP](https://bughunters.google.com/).
