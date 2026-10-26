import { Component, computed, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-password-field',
  imports: [ReactiveFormsModule],
  host: { class: 'flex flex-col gap-space-xs' },
  template: `
    <label [attr.for]="fieldId()" class="text-label-lg uppercase text-on-surface-variant">{{ label() }}</label>
    <div class="relative">
      <input
        [id]="fieldId()"
        [formControl]="control()"
        [attr.autocomplete]="autocomplete()"
        [type]="visible() ? 'text' : 'password'"
        [attr.aria-invalid]="error() !== null"
        [attr.aria-describedby]="describedBy()"
        class="min-h-11 w-full rounded-lg border bg-surface-container-lowest py-space-sm pr-14 pl-space-md text-body-md text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        [class.border-error]="error() !== null"
        [class.border-outline-variant]="error() === null"
      />
      <button
        type="button"
        [attr.data-testid]="fieldId() + '-toggle'"
        [attr.aria-controls]="fieldId()"
        [attr.aria-pressed]="visible()"
        [attr.aria-label]="visible() ? 'Hide password' : 'Show password'"
        class="absolute inset-y-0 right-0 flex h-11 min-h-11 w-11 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        (click)="toggle()"
      >
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke-linecap="round" stroke-linejoin="round" />
          <circle cx="12" cy="12" r="3" />
          @if (visible()) {
            <path d="M4 4l16 16" stroke-linecap="round" />
          }
        </svg>
      </button>
    </div>
    @if (hint(); as text) {
      <p [id]="fieldId() + '-hint'" class="text-body-sm text-on-surface-variant">{{ text }}</p>
    }
    @if (error(); as message) {
      <p [id]="fieldId() + '-error'" [attr.data-testid]="fieldId() + '-error'" class="text-body-sm text-error">{{ message }}</p>
    }
  `,
})
export class PasswordField {
  readonly control = input.required<FormControl<string>>();
  readonly fieldId = input.required<string>();
  readonly label = input.required<string>();
  readonly autocomplete = input.required<string>();
  readonly error = input<string | null>(null);
  readonly hint = input<string | null>(null);

  protected readonly visible = signal(false);
  protected readonly describedBy = computed(() => {
    const ids = [this.hint() === null ? null : `${this.fieldId()}-hint`, this.error() === null ? null : `${this.fieldId()}-error`];
    const joined = ids.filter((id) => id !== null).join(' ');
    return joined === '' ? null : joined;
  });

  protected toggle(): void {
    this.visible.update((visible) => !visible);
  }
}
