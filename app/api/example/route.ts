import { NextResponse } from 'next/server';
import { z } from 'zod';

import { mapHttpError } from '@/lib/http-errors';
import { logger } from '@/lib/logger';
import { createExample, listExamples } from '@/services/example.service';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/services/repository';

/**
 * EXAMPLE — `GET /api/example` and `POST /api/example`.
 *
 * Delete this folder with the rest of the example. It exists to show the shape
 * of a route handler over the data layer: parse the request at the boundary,
 * call one service function, map typed errors to status codes, log the ones the
 * caller must not see.
 */

// The Firestore and Cloud Storage SDKs use gRPC and Node APIs, so these
// handlers must run on the Node runtime, not Edge. It is the default for route
// handlers; stated here because deleting it silently breaks the route if the
// default ever changes.
export const runtime = 'nodejs';

// Reads live data on every request. A cached list is a stale list.
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  cursor: z.string().min(1).optional(),
});

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  ownerName: z.string().trim().min(1).max(120),
});

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);

  const query = querySchema.safeParse({
    limit: url.searchParams.get('limit') ?? undefined,
    cursor: url.searchParams.get('cursor') ?? undefined,
  });

  if (!query.success) {
    return NextResponse.json(
      { error: 'invalid_query', message: z.prettifyError(query.error) },
      { status: 400 },
    );
  }

  try {
    const page = await listExamples(query.data);
    return NextResponse.json(page, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const mapped = mapHttpError(error);
    if (!mapped.exposeDetail) logger.error('Listing examples failed', error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  let parsed: z.infer<typeof createSchema>;

  try {
    parsed = createSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_body',
        message: error instanceof z.ZodError ? z.prettifyError(error) : 'Body must be valid JSON',
      },
      { status: 400 },
    );
  }

  try {
    const id = await createExample(parsed);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    const mapped = mapHttpError(error);
    if (!mapped.exposeDetail) logger.error('Creating an example failed', error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
