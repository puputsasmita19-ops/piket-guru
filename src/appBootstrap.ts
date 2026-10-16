// Share the same download between a login interaction and React.lazy. Importing
// this code does not mount the dashboard or start any data subscriptions.
let shellRequest: Promise<typeof import('./AuthenticatedShell')> | null = null;

export function loadAuthenticatedShell() {
  if (!shellRequest) {
    shellRequest = import('./AuthenticatedShell').catch((error) => {
      shellRequest = null;
      throw error;
    });
  }
  return shellRequest;
}

export function preloadAuthenticatedShell() {
  // A failed speculative download must not reject the login itself.
  void loadAuthenticatedShell().catch(() => {});
}
