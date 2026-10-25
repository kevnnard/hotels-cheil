import { TestBed } from '@angular/core/testing';
import { StatePanel } from './state-panel';

describe('StatePanel', () => {
  it('gives the action a touch target of at least 44px', () => {
    const fixture = TestBed.createComponent(StatePanel);
    fixture.componentRef.setInput('heading', 'Nothing here');
    fixture.componentRef.setInput('message', 'Try again later');
    fixture.componentRef.setInput('actionLabel', 'Retry');
    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement).querySelector('button');
    expect(button?.classList.contains('min-h-11')).toBe(true);
  });
});
