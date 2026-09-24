import { NextResponse } from 'next/server';
import { z } from 'zod';

import { mapHttpError } from '@/lib/http-errors';
import { logger } from '@/lib/logger';
import { profileUpdateSchema } from '@/lib/profile-schema';
import { requireUser } from '@/services/auth.service';
import { updateUserProfile } from '@/services/user.service';

/**
 * `PATCH /api/profile` — the caller edits their own profile.
 *
 * There is no `uid` in the path or the body. The profile to change is the
 * session's, so a caller can only ever edit themselves; there is no ownership
 * check to forget. See CLAUDE.md > Authentication in brief.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const user = await requireUser();

    let changes: z.infer<typeof profileUpdateSchema>;
    try {
      changes = profileUpdateSchema.parse(await request.json());
    } catch (error) {
      return NextResponse.json(
        {
          error: 'invalid_body',
          message: error instanceof z.ZodError ? z.prettifyError(error) : 'Body must be valid JSON',
        },
        { status: 400 },
      );
    }

    const profile = await updateUserProfile(user, changes);
    return NextResponse.json({
      displayName: profile.displayName,
      dateOfBirth: profile.dateOfBirth ?? null,
      gender: profile.gender ?? null,
    });
  } catch (error) {
    const mapped = mapHttpError(error);
    if (!mapped.exposeDetail) logger.error('Updating a profile failed', error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
