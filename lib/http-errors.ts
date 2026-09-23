/**
 * Maps the data layer's typed errors to HTTP responses.
 *
 * Matches on `error.name` rather than `instanceof`, which is what keeps this
 * file in `lib/`: the error classes live in `services/`, and `lib/` must not
 * import upward. Matching on the name also survives the duplicate-class problem
 * — two copies of a module in a bundle produce two distinct classes, and
 * `instanceof` quietly stops matching.
 *
 * The rule the table encodes: **a client sees why its own request was wrong,
 * and nothing else.** A validation message names the field the caller sent. A
 * configuration or infrastructure failure is the operator's problem, so the
 * client gets a generic 500 and the detail goes to Cloud Logging.
 */

export interface HttpErrorBody {
  /** Stable machine-readable code. Safe to switch on in a client. */
  error: string;
  /** Human-readable message. Safe to show a user. */
  message: string;
}

export interface MappedHttpError {
  status: number;
  body: HttpErrorBody;
  /** True when the detail is safe to return; false means log it and say little. */
  exposeDetail: boolean;
}

const BY_NAME: Record<string, { status: number; code: string; exposeDetail: boolean }> = {
  DocumentNotFoundError: { status: 404, code: 'not_found', exposeDetail: true },
  DocumentValidationError: { status: 400, code: 'invalid_document', exposeDetail: true },
  UnboundedQueryError: { status: 400, code: 'invalid_query', exposeDetail: true },
  InvalidStoragePathError: { status: 400, code: 'invalid_path', exposeDetail: true },
  UploadRejectedError: { status: 400, code: 'upload_rejected', exposeDetail: true },
  // A missing environment variable is an operator error. Telling a caller which
  // one is missing describes the deployment to anyone who asks.
  ConfigurationError: { status: 500, code: 'server_misconfigured', exposeDetail: false },
};

/** Fallback for anything unrecognised. */
const UNKNOWN = { status: 500, code: 'internal_error', exposeDetail: false } as const;

/**
 * Classifies an unknown thrown value.
 *
 * @example
 * try { ... } catch (error) {
 *   const mapped = mapHttpError(error);
 *   if (!mapped.exposeDetail) logger.error('create failed', error);
 *   return NextResponse.json(mapped.body, { status: mapped.status });
 * }
 */
export function mapHttpError(error: unknown): MappedHttpError {
  const name = error instanceof Error ? error.name : '';
  const rule = BY_NAME[name] ?? UNKNOWN;

  return {
    status: rule.status,
    body: {
      error: rule.code,
      message:
        rule.exposeDetail && error instanceof Error
          ? error.message
          : 'The request could not be completed. The failure has been logged.',
    },
    exposeDetail: rule.exposeDetail,
  };
}
