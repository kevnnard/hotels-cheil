type DialogMethods = Partial<Pick<HTMLDialogElement, 'showModal' | 'close'>>;

const dialogPrototype = HTMLDialogElement.prototype as DialogMethods;

export function installDialogStub(): void {
  Object.defineProperty(dialogPrototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute('open', '');
      this.setAttribute('data-modal', 'true');
    },
  });
  Object.defineProperty(dialogPrototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      if (!this.hasAttribute('open')) {
        return;
      }
      this.removeAttribute('open');
      this.removeAttribute('data-modal');
      this.dispatchEvent(new Event('close'));
    },
  });
}

export function removeDialogStub(): void {
  delete dialogPrototype.showModal;
  delete dialogPrototype.close;
}
