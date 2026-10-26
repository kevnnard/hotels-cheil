import { HttpErrorResponse } from '@angular/common/http';

const retryMessage = 'Could not save your rating. Try again.';

const messagesByStatus: Readonly<Record<number, string>> = {
  400: 'The rating must be between 1 and 5.',
  401: 'Your session has expired. Sign in again.',
  403: 'You do not have permission to rate.',
  404: 'This hotel no longer exists.',
};

export function describeRatingFailure(error: unknown): string {
  return error instanceof HttpErrorResponse ? (messagesByStatus[error.status] ?? retryMessage) : retryMessage;
}
