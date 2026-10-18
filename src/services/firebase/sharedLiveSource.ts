/** Shares identical active subscriptions only; never survives account teardown. */
type Observer<T> = { next: (value: T) => void; error?: (error: Error) => void };
type Channel = { scope: string; identity: unknown; observers: Set<Observer<any>>; stop: () => void; ready: boolean; value: any; closed: boolean };
const channels = new Set<Channel>();
export function sharedLiveSource<K, T>(scope: string, identity: K, equal: (a: K, b: K) => boolean,
  start: (next: (value: T) => void, error: (error: Error) => void) => () => void,
  next: (value: T) => void, error?: (error: Error) => void): () => void {
  let channel = [...channels].find(c => c.scope === scope && equal(c.identity as K, identity));
  const observer = { next, error };
  if (channel) { channel.observers.add(observer); if (channel.ready) { try { next(channel.value); } catch (e) { console.warn('Pembaca realtime gagal:', e); } } }
  else {
    channel = { scope, identity, observers: new Set([observer]), stop: () => {}, ready: false, value: undefined, closed: false };
    channels.add(channel); const c = channel;
    try {
      c.stop = start(value => {
        if (c.closed) return;
        c.ready = true; c.value = value;
        for (const o of [...c.observers]) { try { o.next(value); } catch (e) { console.warn('Pembaca realtime gagal:', e); } }
      }, e => {
        if (c.closed) return;
        // Firestore errors terminate a listener. A later mount must create a
        // fresh SDK source, rather than attach to this permanently dead one.
        c.closed = true; c.ready = false; c.value = undefined; channels.delete(c); c.stop();
        for (const o of [...c.observers]) { try { o.error?.(e); } catch (error) { console.warn('Pembaca error realtime gagal:', error); } }
      });
      if (c.closed) c.stop(); // Also handles a synchronous failure during start.
    }
    catch (e) { channels.delete(c); throw e; }
  }
  const c = channel;
  let active = true;
  return () => { if (!active) return; active = false; c.observers.delete(observer); if (!c.observers.size && !c.closed) { c.closed = true; channels.delete(c); c.stop(); c.value = undefined; } };
}
