/**
 * R97: Deduplicate only simultaneous validation requests for the SAME Firebase
 * User object. No result is cached after settlement: a reload/reconnect must
 * still verify the current token, profile and revocation marker on the server.
 */
export function createSessionVerificationFlight<TUser extends { uid: string }, TResult>(
  verify: (user: TUser) => Promise<TResult>,
): (user: TUser) => Promise<TResult> {
  let pending: { user: TUser; request: Promise<TResult> } | null = null;

  return (user: TUser): Promise<TResult> => {
    if (pending?.user === user && pending.user.uid === user.uid) return pending.request;
    const request = Promise.resolve().then(() => verify(user));
    pending = { user, request };
    const clear = () => { if (pending?.request === request) pending = null; };
    // Both rejection paths are handled. Do not swallow a validation failure.
    void request.then(clear, clear);
    return request;
  };
}
