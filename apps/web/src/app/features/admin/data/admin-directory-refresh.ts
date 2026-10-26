import { Injectable, signal } from '@angular/core';

export interface DirectoryChange {
  readonly message: string | null;
  readonly sequence: number;
}

@Injectable({ providedIn: 'root' })
export class AdminDirectoryRefresh {
  private readonly latest = signal<DirectoryChange | null>(null);

  readonly change = this.latest.asReadonly();

  announce(message: string | null = null): void {
    this.latest.update((previous) => ({ message, sequence: (previous?.sequence ?? 0) + 1 }));
  }
}
