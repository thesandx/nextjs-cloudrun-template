import { NextResponse } from 'next/server';
import { z } from 'zod';

import { mapHttpError } from '@/lib/http-errors';
import { logger } from '@/lib/logger';
import { requireUser } from '@/services/auth.service';
import { finalizeExampleImage } from '@/services/example.service';

/**
 * EXAMPLE — `POST /api/example/finalize`.
 *
 * Step 3 of the three-step upload. Verifies the object the browser actually
 * wrote, promotes it out of `tmp/`, and points the document at it.
 *
 * A signed URL constrains a well-behaved client. This step is what makes the
 * constraint true for every other kind.
 *
 * Both `exampleId` and `tmpPath` come from the caller, so the service checks
 * that the path belongs to that document as well as that the session owns it.
 * Checking only ownership would let a caller adopt another user's pending
 * upload into their own row.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  exampleId: z.string().min(1).max(128),
  tmpPath: z.string().min(1).max(512),
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
    const user = await requireUser();
    const document = await finalizeExampleImage({ ...parsed, ownerId: user.uid });
    return NextResponse.json({ id: document.id, imagePath: document.imagePath });
  } catch (error) {
    const mapped = mapHttpError(error);
    if (!mapped.exposeDetail) {
      logger.error('Finalizing an example upload failed', error, {
        exampleId: parsed.exampleId,
        path: parsed.tmpPath,
      });
    }
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
