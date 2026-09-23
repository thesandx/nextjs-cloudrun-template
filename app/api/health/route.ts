import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { formatIst } from '@/lib/utils';
import { checkDependencies } from '@/services/health.service';

/**
 * Liveness / readiness probe.
 *
 * Consumed by three things, which is why the default response must stay fast
 * and dependency-free:
 *   - the Docker `HEALTHCHECK` instruction (local and Compose runs)
 *   - Cloud Run startup and liveness probes
 *   - uptime checks / load balancer health checks
 *
 * The default response deliberately does NOT reach out to databases or
 * third-party APIs. A probe that fails when a downstream dependency blips will
 * make Cloud Run kill a perfectly healthy container and amplify the outage.
 *
 * `?deep=1` opts into dependency checks, behind TWO gates:
 *   1. the query parameter, so the platform's own probe can never trigger it;
 *   2. `HEALTH_DEEP_CHECKS_ENABLED`, which is off by default, so an attacker
 *      cannot use the endpoint to probe your infrastructure's latency.
 *
 * **Point only dashboards and uptime checks at `?deep=1`. Never the
 * orchestrator.** Deep mode answers 503 when a dependency is down, which is
 * what an alert needs and exactly what a liveness probe must not see.
 */

// Never cached, never statically prerendered: a cached "ok" is worthless.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// The deep checks use the Firestore and Cloud Storage SDKs, which need Node.
export const runtime = 'nodejs';

const startedAt = Date.now();

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function GET(request: Request): Promise<NextResponse> {
  const wantsDeep = new URL(request.url).searchParams.get('deep') !== null;

  const base = {
    service: env.appName,
    version: env.appVersion,
    environment: env.nodeEnv,
    region: env.gcpRegion || 'local',
    // Last deploy time in IST, or null when this build was not deployed by
    // the pipeline (local dev). Lets you confirm a deploy without GitHub.
    deployedAt: formatIst(env.deployedAt),
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  };

  if (!wantsDeep) {
    return NextResponse.json({ status: 'ok', ...base }, { status: 200, headers: NO_STORE });
  }

  if (!env.healthDeepChecksEnabled) {
    return NextResponse.json(
      {
        status: 'ok',
        ...base,
        checks: null,
        note: 'Deep checks are disabled. Set HEALTH_DEEP_CHECKS_ENABLED=true to enable them.',
      },
      { status: 200, headers: NO_STORE },
    );
  }

  const deep = await checkDependencies();

  return NextResponse.json(
    { status: deep.ok ? 'ok' : 'degraded', ...base, checks: deep.checks },
    { status: deep.ok ? 200 : 503, headers: NO_STORE },
  );
}
