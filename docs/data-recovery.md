# Data safety and recovery

Agents write most of the code in a project built from this template. This document records how the data stays recoverable when that code is wrong. It also gives the steps to recover data.

Read it before you write code that deletes data, before you run a bulk write, and during an incident that involves data.

---

## The controls

Each layer stops a different failure. No single layer is sufficient.

| Layer                                   | What it stops                                                          | Where                                 |
| --------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------- |
| No cloud credentials in pull requests   | A pull request cannot read, change or delete data in CI                | `.github/workflows/pr-validation.yml` |
| The deployer cannot read data           | A broken pipeline cannot touch data                                    | `scripts/gcp-bootstrap.sh`            |
| IAM condition on `roles/datastore.user` | The app cannot reach another app's database                            | `scripts/gcp-bootstrap.sh`            |
| Soft delete by default                  | A deleted document stays in the database and `restore` returns it      | `services/repository.ts`              |
| `update` never creates a document       | A late write cannot bring back a deleted document                      | `services/repository.ts`              |
| zod validation on read and on write     | A schema change that does not match the data fails, it does not hide   | `services/repository.ts`              |
| `data-safety/no-permanent-delete` lint  | A new permanent delete needs a stated reason in the diff               | `eslint.config.mjs`                   |
| Code owner review on the data layer     | A human approves each change to `services/` and the delete rules       | `.github/CODEOWNERS`                  |
| Delete protection on the database       | `gcloud firestore databases delete` refuses until a human turns it off | `scripts/gcp-bootstrap.sh`            |
| Point-in-time recovery, 7 days          | You can read the database as it was at any minute in the last 7 days   | `scripts/gcp-bootstrap.sh`            |
| Daily backups, 7-day retention          | A full copy of each day for 7 days                                     | `scripts/gcp-bootstrap.sh`            |
| Bucket soft delete, 7 days              | A deleted object is recoverable for 7 days                             | `scripts/gcp-bootstrap.sh`            |

`tests/data-safety.test.ts` fails if the lint rule stops working, or if the bootstrap stops turning on delete protection, point-in-time recovery, backups or bucket soft delete.

### What these controls do not cover

- **Data older than 7 days.** Point-in-time recovery and backups both keep 7 days. If you need more, increase `BACKUP_RETENTION_DAYS` in `scripts/gcp-bootstrap.sh` (the maximum is 14 weeks), or add a weekly schedule.
- **Loss of the project.** The backups are in the same project as the database. A person with the Owner role can delete both. A copy in a separate project, with a retention lock, is the control for that. It is not part of the template.
- **A bad write that you see after 7 days.** Monitor for it. Recovery depends on how fast you see the problem.

---

## Rules for code that changes data

1. **Use `softDelete`.** Reads exclude the document, and `restore` returns it.
2. **Use `hardDelete` only for an erasure request.** Put the reason on the line: `// eslint-disable-next-line data-safety/no-permanent-delete -- erasure request`. `deleteUserProfile` in `services/user.service.ts` is the example.
3. **Do not disable the rule for a whole file.** Each permanent delete is a separate decision, and a reviewer must see each one.
4. **Do not call `.delete()` on a document reference, a batch or a transaction** in application code. Use the repository.
5. **Do not use `recursiveDelete`** in application code. It removes a document and every subcollection below it.

The lint finds the usual forms: `hardDelete`, `recursiveDelete`, `doc(id).delete()`, `snapshot.ref.delete()` and `batch.delete(ref)`. It cannot find a delete through a variable with an unusual name. That stays with the reviewer.

---

## Before a bulk write or a migration

A bulk write is any script that changes more than a few documents: a backfill, a migration, a cleanup. Do these steps in this order.

1. **Write the script with a dry run as the default.** The script prints what it would change. It writes only when you give `--apply`.
2. **Put a limit on each run.** Use a `--max` flag with a small default, for example 500 documents. Increase it only after a run is correct.
3. **Never delete in a bulk write.** Use `softDelete`. Purge later, as a separate decision, after the data has been correct for the full recovery window.
4. **Make sure that point-in-time recovery is on, and write down the time.**

   ```bash
   gcloud firestore databases describe --database=DATABASE_ID \
     --format='value(pointInTimeRecoveryEnablement,earliestVersionTime,deleteProtectionState)'
   date -u +%Y-%m-%dT%H:%M:00Z   # your restore point
   ```

   The first value must be `POINT_IN_TIME_RECOVERY_ENABLED`. If it is not, stop and run `scripts/gcp-bootstrap.sh` again.

5. **Run the dry run on production, and read the output.** Compare the count with what you expect.
6. **Run with `--apply`.** Keep the restore point until the change has been correct for 7 days.
7. **Say in the pull request** that the change includes a bulk write, and give the restore point.

A human runs a bulk write against production, with their own credentials. An agent does not. An agent session has no production credentials, and it must not get them.

---

## Recover data

All recovery commands make a **new** database. They never write over the live one. You then copy the documents you need back into the live database.

### Choose the path

| Problem                                                   | Path                                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------- |
| One document was soft-deleted by mistake                  | [Restore a soft-deleted document](#restore-a-soft-deleted-document) |
| Documents were changed or hard-deleted in the last 7 days | [Clone from a point in time](#clone-from-a-point-in-time)           |
| You need a copy of a full day                             | [Restore from a backup](#restore-from-a-backup)                     |
| An object in Cloud Storage was deleted in the last 7 days | [Restore a deleted object](#restore-a-deleted-object)               |

Set these first:

```bash
PROJECT_ID=my-gcp-project
DATABASE_ID=my-app            # the live database
RESTORE_ID=my-app-restore     # a new, temporary database
```

### Restore a soft-deleted document

The document is still in the database, with `deletedAt` set. Call `restore` from a server-side script or a route:

```ts
await notes.restore(id);
```

To find it, use `list({ ..., includeDeleted: true })`.

### Clone from a point in time

Use the time from before the bad change. The time must be on a whole minute, and in the last 7 days.

```bash
gcloud firestore databases clone \
  --source-database="projects/${PROJECT_ID}/databases/${DATABASE_ID}" \
  --snapshot-time=2026-10-13T09:00:00Z \
  --destination-database="${RESTORE_ID}"
```

The clone can take some time for a large database. Then [copy the documents back](#copy-documents-back).

### Restore from a backup

```bash
gcloud firestore backups list --format='table(name,database,snapshotTime,state)'

gcloud firestore databases restore \
  --source-backup=projects/${PROJECT_ID}/locations/LOCATION/backups/BACKUP_ID \
  --destination-database="${RESTORE_ID}"
```

Then [copy the documents back](#copy-documents-back).

### Copy documents back

The app cannot read `RESTORE_ID`. Its IAM condition names the live database only, and that is correct. Do not change the condition.

1. Write a script in `scripts/` that reads the affected documents from `RESTORE_ID` and writes them to `DATABASE_ID`. Follow [Before a bulk write or a migration](#before-a-bulk-write-or-a-migration): a dry run first, and a limit on each run.
2. A human runs the script with their own credentials (`gcloud auth application-default login`).
3. Make sure that the app reads the documents correctly.
4. Delete the temporary database:

   ```bash
   gcloud firestore databases update --database="${RESTORE_ID}" --no-delete-protection
   gcloud firestore databases delete --database="${RESTORE_ID}"
   ```

Do not point the app at the restored database. That needs a new IAM condition, a new deploy and a second database to keep. Copying the documents back is smaller and easier to undo.

### Restore a deleted object

```bash
gcloud storage ls --soft-deleted gs://BUCKET/PATH
gcloud storage restore gs://BUCKET/PATH#GENERATION
```

---

## Test the restore

A backup that nobody has restored is not known to work. Do this each quarter, and after each change to the bootstrap.

1. Clone the live database from a time one hour ago, as in [Clone from a point in time](#clone-from-a-point-in-time).
2. Count the documents in one collection in each database. The counts must be close.
3. Delete the temporary database.
4. Write the date and the result in your team's runbook.
