# ADR-0003: Use Firestore in Native mode and Cloud Storage for every app from this template

- **Status:** Accepted
- **Date:** 2026-09-22
- **Deciders:** template maintainers

## Context

The template deployed an application with no persistence. Every project generated from it therefore began by choosing a database, writing the provisioning, wiring the credentials and inventing a data-access layer. Four projects produced four different answers, and none of them was reviewed.

The constraints that shape the choice:

- **Cloud Run scales to zero, and scales out hard.** An instance count that moves between 0 and 10 makes a connection-pooled database awkward: each instance holds its own pool, and a traffic spike opens pools faster than the database accepts connections.
- **No long-lived credentials may exist.** [ADR-0002](./0002-use-workload-identity-federation.md) removed service account keys from the pipeline. A database reached with a password in Secret Manager reintroduces the shape of the problem it solved.
- **Several apps share one GCP project.** That is how the template is used in practice. An app's identity must not reach another app's data, and the isolation must survive somebody forgetting about it.
- **Applications need file storage.** Uploads through a Cloud Run instance are bounded by a 32 MiB request limit and hold a request slot for the length of the user's connection.
- **The region is `asia-south1` by default,** matching the Cloud Run service.

Doing nothing means every new app re-decides all of this, badly and differently.

## Decision

We will provision, for every application generated from this template:

- a **Firestore database in Native mode**, with a **named** database id of `<app-slug>-db`, in the same region as the Cloud Run service;
- a **Cloud Storage bucket** named `<project-id>-<app-slug>-media`, in that same region, with uniform bucket-level access and public access prevention enforced;
- access from the Cloud Run runtime service account only, scoped to those two resources: `roles/datastore.user` under an IAM condition naming the database, and `roles/storage.objectUser` on the bucket;
- `roles/iam.serviceAccountTokenCreator` on the runtime account **for itself**, so V4 signed URLs work with no key file.

Both are reached through Application Default Credentials. No JSON key exists at any point.

The template also ships a typed repository over Firestore (`services/repository.ts`) that enforces the modeling rules in `CLAUDE.md` — auto ids, bounded queries, cursor pagination, server timestamps, soft delete, zod validation on read and write.

## Alternatives considered

### Option A — Firestore Native + Cloud Storage (chosen)

- Serverless, with no connections to pool. It fits scale-to-zero exactly: an instance that has served nothing holds nothing open.
- Authentication is IAM, so the keyless posture of ADR-0002 extends to the data layer unchanged. There is no password to rotate and no secret to leak.
- Named databases give per-app isolation **inside one project**, enforced by an IAM condition rather than by convention. That is the property that makes a shared project safe.
- Scales horizontally without an operator deciding when to.
- Cloud Storage handles uploads directly from the browser through signed URLs, so bytes never pass through Cloud Run.

The cost is real and is stated below: a data model that must be designed around its queries, and no joins.

### Option B — Cloud SQL (PostgreSQL)

Genuinely the better database for relational work: joins, transactions across arbitrary rows, a mature migration story, SQL that every developer already knows. Rejected for the deployment shape rather than for the database.

- It does not scale to zero. The smallest always-on instance costs more per month than a low-traffic Cloud Run service costs per year, and every app from this template would pay it.
- Connection management with autoscaling Cloud Run needs the Cloud SQL Auth Proxy or a connection pooler, plus a per-instance pool budget that has to be re-tuned as `max-instances` changes.
- Authentication is a password in Secret Manager, or IAM database authentication with its own setup. The first reintroduces a long-lived credential.
- Per-app isolation means a database per app plus a role per app, which is more moving parts than an IAM condition.

**Choose PostgreSQL instead when** the application's core value is relational: multi-table transactions, ad-hoc reporting, or a schema that genuinely normalises. That is a project-level decision, taken in a new ADR that supersedes this one.

### Option C — Firestore in Datastore mode

Same infrastructure and the same scaling properties. Rejected because Native mode is the actively developed surface: real-time listeners, collection-group queries and the aggregation queries the repository's `count()` depends on are Native-mode features. Datastore mode exists for migrating existing App Engine applications, which is not this.

The mode **cannot be changed after the database is created**, so this is a one-way door and worth stating.

### Option D — one GCP project per application

The strongest isolation available: separate quota, separate billing, separate blast radius, and the default database can be used without a naming scheme.

Rejected as the default because it multiplies the setup cost of the thing this template exists to make cheap. Every new app would need a project created, billing attached, APIs enabled, a Workload Identity Pool built and a budget configured, before writing a line of code. The IAM condition on a named database gets most of the isolation for none of that.

**Still the right answer** for an application with a compliance boundary, a separate billing owner, or a blast radius that must not include anything else. Nothing here prevents it: `gcp-bootstrap.sh` works unchanged in a project of its own.

### Option E — a self-hosted database on a VM

Cheapest on paper. Rejected: backups, patching, failover and capacity become the application team's problem, permanently. The template exists to remove undifferentiated operational work, not to add some.

## Consequences

**Good**

- A new application gets a database and a bucket from one idempotent command, in the right region, with least-privilege access and no key file.
- The keyless posture of ADR-0002 now covers data access, not just deployment.
- Several apps share one project safely. The isolation is an IAM condition, which cannot be forgotten the way a `where` clause can.
- Scale-to-zero stays true. An idle app costs storage, not compute.
- Uploads do not pass through Cloud Run, so the 32 MiB request limit and the request-slot cost both disappear.
- The repository helper makes the scalable choice the default one: a developer who does nothing special gets auto ids, bounded queries and cursor pagination.

**Bad**

- **No joins.** Read-heavy data must be denormalised, which means fan-out updates when a denormalised value changes. This is the single biggest adjustment for anyone arriving from SQL.
- **Queries must be designed before documents.** A model that was not designed around its access patterns cannot be queried efficiently later without a migration.
- **Composite indexes are a deployment artefact.** A query that needs one fails with `FAILED_PRECONDITION` until the index exists and has built. The deploy pipeline publishes indexes before the app for this reason.
- **The database's location and mode are permanent.** Changing either means creating a second database and migrating every document.
- **Ad-hoc reporting is poor.** Aggregation queries cover counts and sums; anything richer means exporting to BigQuery.
- **Four more dependencies**, two of them large Google Cloud SDKs, and `protobufjs` needed an entry in `allowBuilds`.

**Neutral**

- Firestore bills per operation, not per hour. A low-traffic app is much cheaper than Cloud SQL; a read-heavy one at scale may not be. Model the cost before assuming either way.
- Security rules are in the repository and deployed by CI, but are defence in depth only while access is server-side — admin credentials bypass them.

## Revisit when

- The application needs transactions across more than a handful of documents, or ad-hoc relational queries. Firestore transactions are real but bounded; a reporting requirement is the usual trigger.
- Denormalisation fan-out becomes the dominant write cost. That is the measurable sign the data is relational and the database is not.
- Per-operation billing exceeds what an always-on Cloud SQL instance would cost. Read-heavy workloads reach this before write-heavy ones.
- A compliance boundary requires a project per application. Move to Option D; nothing in the code changes.
- Google ships per-database IAM as a first-class resource, removing the need for the condition expression in `gcp-bootstrap.sh`.

## References

- [Firestore: choose between Native mode and Datastore mode](https://cloud.google.com/firestore/docs/firestore-or-datastore)
- [Firestore: best practices](https://cloud.google.com/firestore/docs/best-practices) — hotspots, the 500/50/5 rule, index exemptions
- [Firestore: secure a database with IAM conditions](https://cloud.google.com/firestore/docs/security/iam)
- [Cloud Storage: signed URLs](https://cloud.google.com/storage/docs/access-control/signed-urls)
- [ADR-0001](./0001-use-cloud-run-for-hosting.md) — why Cloud Run, which constrains this choice
- [ADR-0002](./0002-use-workload-identity-federation.md) — why no service account keys exist
