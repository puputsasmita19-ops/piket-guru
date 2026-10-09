import {
  sanitizeLobbyTvConfig,
  stripHtml,
  DEFAULT_LOBBY_TV_CONFIG,
  ALL_TV_PANELS,
  LobbyTvConfig,
} from '../src/types/lobbyTv.types';

function runTests() {
  console.log('=== PENGUJIAN MODE TV LOBI & SANITIZATION ===\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      process.exitCode = 1;
    }
  }

  // TEST 1: Default config fallback
  const defaultConfig = sanitizeLobbyTvConfig(null);
  assert(defaultConfig.enabled === true, 'Fallback enabled default');
  assert(defaultConfig.transition === 'slide', 'Fallback transition default');
  assert(defaultConfig.transitionDurationMs === 500, 'Fallback transitionDurationMs default');
  assert(defaultConfig.slideIntervalSec === 10, 'Fallback slideIntervalSec default');
  assert(defaultConfig.enabledPanels.length === 6, 'Fallback enabledPanels default length 6');
  assert(defaultConfig.timezone === 'Asia/Jakarta', 'Fallback timezone Asia/Jakarta');

  // TEST 2: HTML sanitization
  const rawHtml = '<script>alert("XSS")</script>Pengumuman <b>Penting</b> &nbsp; Sekolah';
  const stripped = stripHtml(rawHtml);
  assert(!stripped.includes('<script>') && !stripped.includes('<b>'), 'stripHtml removes HTML tags');
  assert(stripped.includes('Pengumuman Penting   Sekolah'), 'stripHtml preserves clean text');

  // TEST 3: Safe ticker messages with HTML injection
  const dangerousConfig: Partial<LobbyTvConfig> = {
    tickerMessages: [
      '<img src=x onerror=alert(1)> Selamat Pagi',
      '   ',
      '<b>Siswa dilarang merokok</b>',
    ],
    customSubtitle: '<i>Subjudul TV</i>',
  };
  const sanitizedDangerous = sanitizeLobbyTvConfig(dangerousConfig);
  assert(sanitizedDangerous.tickerMessages.length === 2, 'Filters out blank whitespace messages');
  assert(sanitizedDangerous.tickerMessages[0] === 'Selamat Pagi', 'Strips img onerror tag from ticker message');
  assert(sanitizedDangerous.tickerMessages[1] === 'Siswa dilarang merokok', 'Strips bold tags from ticker message');
  assert(sanitizedDangerous.customSubtitle === 'Subjudul TV', 'Strips HTML from customSubtitle');

  // TEST 4: Invalid fields fallback to safe values
  const invalidConfig: Partial<LobbyTvConfig> = {
    transition: 'spin' as any,
    transitionDurationMs: -999,
    slideIntervalSec: 1, // too short (< 3s)
    tickerSpeed: 'supersonic' as any,
    tickerFontSize: 'giant' as any,
    densityScale: 'ultra' as any,
    timezone: 'America/New_York' as any,
    enabledPanels: ['non_existent_panel' as any],
  };
  const sanitizedInvalid = sanitizeLobbyTvConfig(invalidConfig);
  assert(sanitizedInvalid.transition === 'slide', 'Invalid transition reverts to safe slide');
  assert(sanitizedInvalid.transitionDurationMs === 500, 'Negative duration reverts to default 500ms');
  assert(sanitizedInvalid.slideIntervalSec === 10, 'Interval < 3s reverts to default 10s');
  assert(sanitizedInvalid.tickerSpeed === 'normal', 'Invalid ticker speed reverts to normal');
  assert(sanitizedInvalid.tickerFontSize === 'md', 'Invalid ticker font size reverts to md');
  assert(sanitizedInvalid.densityScale === 'standard', 'Invalid density reverts to standard');
  assert(sanitizedInvalid.timezone === 'Asia/Jakarta', 'Invalid timezone reverts to Asia/Jakarta');
  assert(sanitizedInvalid.enabledPanels.length === 6, 'Empty valid panels reverts to all 6 defaults');

  // TEST 5: Clock formatting checks
  const testDate = new Date('2026-10-09T08:30:45Z');
  const time24h = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(testDate);
  assert(time24h.length >= 8, `24h time formatting output valid: ${time24h}`);

  const timeNoSeconds = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(testDate);
  assert(!timeNoSeconds.includes(':45'), `Time without seconds output valid: ${timeNoSeconds}`);

  // TEST 6: All panels definition
  assert(ALL_TV_PANELS.length === 6, 'ALL_TV_PANELS has 6 standard operational panels');
  const panelIds = ALL_TV_PANELS.map((p) => p.id);
  assert(panelIds.includes('duty_teachers'), 'Contains duty_teachers panel');
  assert(panelIds.includes('substitutions'), 'Contains substitutions panel');
  assert(panelIds.includes('visitors'), 'Contains visitors panel');
  assert(panelIds.includes('discipline'), 'Contains discipline panel');
  assert(panelIds.includes('announcements'), 'Contains announcements panel');
  assert(panelIds.includes('school_identity'), 'Contains school_identity panel');

  console.log(`\nHasil: ${passed}/${total} pengujian berhasil dijalankan.`);
}

runTests();
