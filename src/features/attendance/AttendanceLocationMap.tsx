// OpenStreetMap is the only embedded provider. No Google SDK, key or billing.
// AttendanceMapPreview already loads this module lazily after opening GPS.
export { default } from './AttendanceOpenStreetMap';
