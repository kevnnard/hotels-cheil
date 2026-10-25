import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet],
  template: `
    <div data-testid="admin-layout" class="min-h-screen">
      <router-outlet />
    </div>
  `,
})
export class AdminLayout {}
