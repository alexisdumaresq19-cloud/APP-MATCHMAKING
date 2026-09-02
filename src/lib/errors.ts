export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string = "APP_ERROR",
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Introuvable.") {
    super(message, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Accès refusé.") {
    super(message, "FORBIDDEN", 403);
    this.name = "ForbiddenError";
  }
}

export class RateLimitedError extends AppError {
  constructor(message = "Trop de tentatives. Veuillez réessayer plus tard.") {
    super(message, "RATE_LIMITED", 429);
    this.name = "RateLimitedError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
