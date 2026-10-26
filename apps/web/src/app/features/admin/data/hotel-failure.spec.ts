import { HttpErrorResponse } from '@angular/common/http';
import { describeHotelFailure, describeImageFailure, describeVisibilityFailure, networkMessage, permissionMessage } from './hotel-failure';

function failure(status: number, error: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, error });
}

describe('describeHotelFailure', () => {
  it('maps camelCase, PascalCase, nested and model binding keys to the form fields', () => {
    const result = describeHotelFailure(
      failure(400, {
        errors: {
          name: ['Name is required.'],
          PricePerNight: ['Price per night must be greater than 0.'],
          'Address.City': ['City cannot exceed 100 characters.'],
          '$.discountPercent': ['The JSON value could not be converted.'],
          postalcode: ['Postal code cannot exceed 20 characters.'],
        },
      }),
    );

    expect(result.fieldErrors).toEqual({
      name: 'Name is required.',
      pricePerNight: 'Price per night must be greater than 0.',
      city: 'City cannot exceed 100 characters.',
      discountPercent: 'The JSON value could not be converted.',
      postalCode: 'Postal code cannot exceed 20 characters.',
    });
    expect(result.details).toEqual([]);
    expect(result.message).toBe('Check the highlighted fields and try again.');
    expect(result.retryable).toBe(false);
  });

  it('keeps the messages of unknown keys such as request for the alert', () => {
    const result = describeHotelFailure(failure(400, { errors: { request: ['Email is not valid.'], other: 'Odd.' } }));

    expect(result.fieldErrors).toEqual({});
    expect(result.details).toEqual(['Email is not valid.', 'Odd.']);
    expect(result.message).toBe('The hotel could not be saved.');
  });

  it('explains a 400 without an errors object', () => {
    const result = describeHotelFailure(failure(400, '<b>bad</b>'));

    expect(result.message).toBe('The hotel could not be saved.');
    expect(result.details).toEqual([]);
  });

  it('describes a forbidden answer', () => {
    expect(describeHotelFailure(failure(403)).message).toBe(permissionMessage);
    expect(permissionMessage).toBe('You do not have permission to do this.');
  });

  it('describes a network failure as retryable', () => {
    const result = describeHotelFailure(failure(0));

    expect(result.message).toBe(networkMessage);
    expect(result.retryable).toBe(true);
  });

  it('describes a missing hotel', () => {
    const result = describeHotelFailure(failure(404, { title: 'The hotel does not exist.' }));

    expect(result.message).toBe('This hotel no longer exists.');
    expect(result.retryable).toBe(false);
  });

  it('describes other failures as retryable', () => {
    expect(describeHotelFailure(failure(500)).retryable).toBe(true);
    expect(describeHotelFailure(new Error('boom')).message).toBe('Something went wrong while saving. Try again.');
  });
});

describe('describeImageFailure', () => {
  it('shows the image field message of a 400', () => {
    expect(describeImageFailure(failure(400, { errors: { image: ['The image is empty.'] } }))).toBe('The image is empty.');
  });

  it.each([
    [413, 'The image exceeds 10485760 bytes.'],
    [415, 'Only static JPEG, PNG and WebP images are accepted.'],
    [422, 'The image cannot be stored within 400000 bytes without losing quality.'],
  ])('shows the problem title of a %s', (status, title) => {
    expect(describeImageFailure(failure(status, { title, status }))).toBe(title);
  });

  it.each([
    [400, 'The image is not valid.'],
    [413, 'The image is too large.'],
    [415, 'This image format is not accepted.'],
    [422, 'The image cannot be accepted.'],
  ])('falls back to a plain message for a %s without details', (status, message) => {
    expect(describeImageFailure(failure(status))).toBe(message);
  });

  it('describes permission, network, missing hotel and unexpected failures', () => {
    expect(describeImageFailure(failure(403))).toBe(permissionMessage);
    expect(describeImageFailure(failure(0))).toBe(networkMessage);
    expect(describeImageFailure(failure(404))).toBe('This hotel no longer exists.');
    expect(describeImageFailure(failure(500))).toBe('We could not update this image. Try again.');
  });
});

describe('describeVisibilityFailure', () => {
  it('describes permission, missing hotel, network and unexpected failures', () => {
    expect(describeVisibilityFailure(failure(403))).toEqual({ message: permissionMessage, retryable: false });
    expect(describeVisibilityFailure(failure(404))).toEqual({ message: 'This hotel no longer exists.', retryable: false });
    expect(describeVisibilityFailure(failure(0))).toEqual({ message: networkMessage, retryable: true });
    expect(describeVisibilityFailure(failure(500))).toEqual({
      message: 'We could not change the visibility. Try again.',
      retryable: true,
    });
    expect(describeVisibilityFailure(new Error('boom')).retryable).toBe(true);
  });

  it('shows the validation message of a 400', () => {
    expect(describeVisibilityFailure(failure(400, { errors: { isActive: ['The active state is required.'] } }))).toEqual({
      message: 'The active state is required.',
      retryable: false,
    });
  });
});
