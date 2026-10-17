// Compatibility entry point: the Google provider has been retired.
// Verify the current free map instead; all external IO is still mocked.
console.log("Google SDK is no longer used. Running the free GPS/map regressions.");
await import("./verify_attendance_gps_map_ui.mjs");
