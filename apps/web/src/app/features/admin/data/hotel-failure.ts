import { HttpErrorResponse } from '@angular/common/http';
import { HotelFailure, HotelField, HotelFieldErrors, VisibilityFailure, hotelFields } from './admin-hotel.models';

export const permissionMessage = 'You do not have permission to do this.';
export const networkMessage = 'We could not reach the server. Check your connection and try again.';
const missingHotelMessage = 'This hotel no longer exists.';
const invalidFieldsMessage = 'Check the highlighted fields and try again.';
const rejectedMessage = 'The hotel could not be saved.';
const unexpectedMessage = 'Something went wrong while saving. Try again.';
const visibilityFallback = 'We could not change the visibility. Try again.';

const imageFallbacks: Readonly<Record<number, string>> = {
  400: 'The image is not valid.',
  413: 'The image is too large.',
  415: 'This image format is not accepted.',
  422: 'The image cannot be accepted.',
};

function toHotelField(key: string): HotelField | null {
  const name = key.replace(/^\$\.?/, '').split('.').pop()?.toLowerCase() ?? '';
  return hotelFields.find((field) => field.toLowerCase() === name) ?? null;
}

function messagesOf(value: unknown): string[] {
  const items = Array.isArray(value) ? value : [value];
  return items.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

function errorsOf(body: unknown): Record<string, unknown> {
  const errors = typeof body === 'object' && body !== null ? (body as { errors?: unknown }).errors : null;
  return typeof errors === 'object' && errors !== null ? (errors as Record<string, unknown>) : {};
}

function titleOf(body: unknown): string | null {
  const title = typeof body === 'object' && body !== null ? (body as { title?: unknown }).title : null;
  return typeof title === 'string' && title.trim() !== '' ? title : null;
}

function validationFailure(body: unknown): HotelFailure {
  const fieldErrors: HotelFieldErrors = {};
  const details: string[] = [];
  for (const [key, value] of Object.entries(errorsOf(body))) {
    const messages = messagesOf(value);
    const field = toHotelField(key);
    if (field === null) {
      details.push(...messages);
    } else if (messages.length > 0 && fieldErrors[field] === undefined) {
      fieldErrors[field] = messages[0];
    }
  }
  const message = Object.keys(fieldErrors).length > 0 ? invalidFieldsMessage : rejectedMessage;
  return { message, details, fieldErrors, retryable: false };
}

function plainFailure(message: string, retryable: boolean): HotelFailure {
  return { message, details: [], fieldErrors: {}, retryable };
}

export function describeHotelFailure(error: unknown): HotelFailure {
  if (!(error instanceof HttpErrorResponse)) {
    return plainFailure(unexpectedMessage, true);
  }
  switch (error.status) {
    case 0:
      return plainFailure(networkMessage, true);
    case 400:
      return validationFailure(error.error);
    case 403:
      return plainFailure(permissionMessage, false);
    case 404:
      return plainFailure(missingHotelMessage, false);
    default:
      return plainFailure(unexpectedMessage, true);
  }
}

export function describeImageFailure(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'We could not update this image. Try again.';
  }
  switch (error.status) {
    case 0:
      return networkMessage;
    case 400:
      return messagesOf(errorsOf(error.error)['image'])[0] ?? titleOf(error.error) ?? imageFallbacks[400];
    case 403:
      return permissionMessage;
    case 404:
      return missingHotelMessage;
    case 413:
    case 415:
    case 422:
      return titleOf(error.error) ?? imageFallbacks[error.status];
    default:
      return 'We could not update this image. Try again.';
  }
}

export function describeVisibilityFailure(error: unknown): VisibilityFailure {
  if (!(error instanceof HttpErrorResponse)) {
    return { message: visibilityFallback, retryable: true };
  }
  switch (error.status) {
    case 0:
      return { message: networkMessage, retryable: true };
    case 400:
      return { message: Object.values(errorsOf(error.error)).flatMap(messagesOf)[0] ?? visibilityFallback, retryable: false };
    case 403:
      return { message: permissionMessage, retryable: false };
    case 404:
      return { message: missingHotelMessage, retryable: false };
    default:
      return { message: visibilityFallback, retryable: true };
  }
}
