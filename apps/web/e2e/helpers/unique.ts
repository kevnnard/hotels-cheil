export function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function strongPassword(): string {
  return `Aurea-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}-7Q`;
}
