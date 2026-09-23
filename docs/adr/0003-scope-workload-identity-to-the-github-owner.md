# ADR-0003: Scope the Workload Identity provider to the GitHub owner

- **Status:** Accepted
- **Date:** 2026-09-23
- **Builds on:** [ADR-0002](./0002-use-workload-identity-federation.md)

---

## Context

ADR-0002 made the pipeline keyless with Workload Identity Federation. The bootstrap script pinned the provider to one repository:

```
assertion.repository == 'owner/repository'
```

The script also gives every repository the same pool id and provider id (`github`). One Google Cloud project therefore holds exactly one provider, which all repositories share.

This combination fails. The script calls `update-oidc` when the provider exists. Bootstrap a second repository into the same project, and the condition changes to name the second repository. The first repository keeps its GitHub secrets, keeps its IAM bindings, and stops deploying.

The failure is silent and delayed. Nothing happens at bootstrap time. The first repository fails on its next deploy, which can be weeks later, in a repository nobody changed. The only message is:

```
unauthorized_client: The given credential is rejected by the attribute condition.
```

This happened in this repository. The deploy of 26 July succeeded. The deploy of 15 September failed at the authentication step, with an identical `deploy.yml`.

The result was a loop: re-run the script for repository A, break repository B, re-run for B, break A.

## Decision

**The provider condition names the owner. The IAM binding names the repository.**

The provider gets:

```
assertion.repository_owner == 'owner'
```

Every repository of that owner writes the same string, so the step is idempotent. Bootstrapping a sibling repository cannot change it.

Authorization moves entirely to the service account binding, which already named the repository and is additive:

```
principalSet://.../workloadIdentityPools/github/attribute.repository/owner/repository
```

Two further changes support this:

1. **`--main-only` becomes a per-repository restriction.** A new mapped attribute, `attribute.repo_ref`, joins the repository and the ref. The binding then names `owner/repository@refs/heads/main`. A provider-wide `assertion.ref` condition would force every sibling repository onto `main` as well, which is the same shared-state defect in a different place.
2. **The script refuses to overwrite a condition set by a different owner.** It compares the live condition with the one it is about to write and stops. `--force-provider-update` overrides this, and says what it costs.

## Consequences

**Good**

- One project can host many repositories. Bootstrapping one never breaks another.
- Setup per repository is additive: a binding, not a change to shared state.
- The silent, delayed failure becomes an immediate, explained refusal.

**The trade-off**

Any repository of the owner can now exchange an OIDC token at this provider. That is a real widening, and it is acceptable because a token alone grants nothing. Impersonation needs a `workloadIdentityUser` binding that names the repository, so repository A cannot reach repository B's deployer service account.

The defence that matters did not move — it was always the binding. The condition stops every repository outside the owner, which is what keeps an unrelated GitHub repository out.

**Accept this only if you trust every repository under the owner.** On a personal account, you create them all. In an organisation where many people can create a repository, prefer one provider per repository (`--provider github-<repo>`) or one project per application.

## Alternatives rejected

**One provider per repository.** Keeps the exact-match condition. Rejected as the default: providers per pool are quota-limited, and it adds a resource per repository for a control the binding already applies. Still the right answer for an untrusted owner, so the script keeps `--provider`.

**One Google Cloud project per application.** The strongest isolation, and it makes the collision impossible. Rejected as the default because it multiplies billing, quota and IAM setup for every small service. It remains the correct choice for production systems with different blast radii.

**Keep the per-repository condition and never share a project.** This is the status quo, undocumented. Rejected: the script's own defaults lead a user straight into the collision, and nothing warns them.
