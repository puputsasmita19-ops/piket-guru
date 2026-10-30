/** Extract only an eleven-character YouTube video ID from known HTTPS hosts. */
export function parseYouTubeVideoId(value?: string | null): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    let id = '';
    if (host === 'youtu.be' || host === 'www.youtu.be') {
      id = url.pathname.split('/')[1] || '';
    } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] === 'watch') id = url.searchParams.get('v') || '';
      if (['embed', 'shorts', 'live'].includes(parts[0])) id = parts[1] || '';
    }
    return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Embed only a validated video ID; never interpolate a raw user-controlled URL. */
export function makeYouTubeEmbedUrl(videoId: string, autoplay = false): string {
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return '';
  const params = new URLSearchParams({
    playsinline: '1',
    controls: '1',
    rel: '0',
    autoplay: autoplay ? '1' : '0',
    mute: autoplay ? '1' : '0',
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}
