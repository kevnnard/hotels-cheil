import { ElementRef } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { ParamMap } from '@angular/router';
import { resolveVisitorReturnUrl } from '../../core/auth/return-url';

export const fieldClasses =
  'min-h-11 w-full rounded-lg border bg-surface-container-lowest px-space-md text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export function visibleError(control: AbstractControl, describe: (control: AbstractControl) => string | null): string | null {
  return control.touched && control.invalid ? describe(control) : null;
}

export function returnQuery(queryParamMap: ParamMap): Record<string, string> {
  const returnUrl = queryParamMap.get('returnUrl');
  return returnUrl !== null && resolveVisitorReturnUrl(returnUrl) === returnUrl ? { returnUrl } : {};
}

export function focusFirstInvalid(
  host: ElementRef<HTMLElement>,
  fields: readonly (readonly [string, AbstractControl])[],
): void {
  const invalid = fields.find(([, control]) => control.invalid);
  if (invalid !== undefined) {
    host.nativeElement.querySelector<HTMLInputElement>(`#${invalid[0]}`)?.focus();
  }
}
