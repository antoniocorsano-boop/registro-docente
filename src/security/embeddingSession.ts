/** In-memory authority for professional embedding operations.
 * Only the protected root opens a generation, after successful authentication.
 * Revocation is synchronous; a previously admitted operation cannot acquire a new lease.
 */
let current: symbol | null = null;

export function openEmbeddingSession(): void {
  current = Symbol('embedding-session');
}

export function revokeEmbeddingSession(): void {
  current = null;
}

export function requireEmbeddingSession(): symbol {
  if (current === null) throw new Error('Sessione embedding non autorizzata.');
  return current;
}

export function assertEmbeddingSession(lease: symbol): void {
  if (current !== lease) throw new Error('Sessione embedding revocata.');
}
