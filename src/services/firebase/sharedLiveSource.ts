/** Shares identical active subscriptions only; never survives account teardown. */
type Observer<T> = { next: (value: T) => void; error?: (error: Error) => void };
type Channel = { scope: string; identity: unknown; observers: Set<Observer<any>>; stop: () => void; ready: boolean; value: any };
const channels = new Set<Channel>();
export function sharedLiveSource<K, T>(scope: string, identity: K, equal: (a: K, b: K) => boolean,
  start: (next: (value: T) => void, error: (error: Error) => void) => () => void,
  next: (value: T) => void, error?: (error: Error) => void): () => void {
  let channel = [...channels].find(c => c.scope === scope && equal(c.identity as K, identity));
  const observer = { next, error };
  if (channel) { channel.observers.add(observer); if (channel.ready) next(channel.value); }
  else {
    channel = { scope, identity, observers: new Set([observer]), stop: () => {}, ready: false, value: undefined };
    channels.add(channel); const c = channel;
    try { c.stop = start(value => { c.ready = true; c.value = value; for (const o of c.observers) { try { o.next(value); } catch (e) { console.warn('Pembaca realtime gagal:', e); } } }, e => { c.ready = false; for (const o of c.observers) o.error?.(e); }); }
    catch (e) { channels.delete(c); throw e; }
  }
  const c = channel;
  let active = true;
  return () => { if (!active) return; active = false; c.observers.delete(observer); if (!c.observers.size) { channels.delete(c); c.stop(); c.value = undefined; } };
}
