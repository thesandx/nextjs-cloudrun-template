import { NextResponse } from 'next/server';
import { z } from 'zod';

import { mapHttpError } from '@/lib/http-errors';
import { logger } from '@/lib/logger';
import { createExampleImageUpload } from '@/services/example.service';

/**
 * EXAMPLE — `POST /api/example/upload`.
 *
 * Step 1 of the three-step upload. Returns a short-lived signed PUT URL and the
 * headers the browser must send with it. The bytes never pass through Cloud
 * Run; see services/storage.service.ts for why that matters.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  exampleId: z.string().min(1).max(128),
  filename: z.string().min(1).max(256),
  contentType: z.string().min(1).max(128),
});

export async function POST(request: Request): Promise<NextResponse> {
  let parsed: z.infer<typeof bodySchema>;

  try {
    parsed = bodySchema.parse(await request.json());
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
    const upload = await createExampleImageUpload(parsed);
    return NextResponse.json(upload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const mapped = mapHttpError(error);
    // The path is safe to log; the signed URL never is — it is a bearer
    // credential for as long as it lives.
    if (!mapped.exposeDetail) {
      logger.error('Signing an example upload failed', error, { exampleId: parsed.exampleId });
    }
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
