import React, { useEffect, useRef, useState } from 'react';
import * as L from '../../vendor/leaflet/leaflet-src.esm.js';
import '../../vendor/leaflet/leaflet.css';
import './attendanceGps.css';
import type { AttendanceMapProps } from './AttendanceMapPreview';

const validPoint = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

export default function AttendanceLocationMap({ schoolLat, schoolLng, radiusMeters, schoolName, coords, provisional }: AttendanceMapProps) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<{ map: any; tiles: any; layers: any; fit: () => void } | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  const [exploring, setExploring] = useState(false);
  const [touch, setTouch] = useState(false);
  const validSchool = validPoint(schoolLat, schoolLng) && Number.isFinite(radiusMeters) && radiusMeters > 0;
  const validUser = coords && validPoint(coords.latitude, coords.longitude) && Number.isFinite(coords.accuracy) && coords.accuracy > 0 ? coords : null;

  useEffect(() => {
    if (!host.current || !validSchool || error) return;
    let map: any;
    let resize: ResizeObserver | undefined;
    let tileTimer: ReturnType<typeof setTimeout> | undefined;
    let loaded = false;
    let active = true;
    const offline = () => setTilesUnavailable(true);
    const online = () => { engine.current?.tiles.redraw(); };
    try {
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      setTouch(coarse);
      map = L.map(host.current, { zoomControl: false, scrollWheelZoom: false, dragging: !coarse, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false });
      map.attributionControl.setPrefix(false);
      const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        minZoom: 2, maxZoom: 19, updateWhenIdle: true, keepBuffer: 0,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
      });
      tiles.on('tileload', () => { loaded = true; if (active) setTilesUnavailable(false); });
      tiles.on('tileerror', () => { if (active && !loaded) setTilesUnavailable(true); });
      const layers = L.featureGroup().addTo(map);
      engine.current = { map, tiles, layers, fit: () => {} };
      map.setView([schoolLat, schoolLng], 17);
      if (navigator.onLine) tiles.addTo(map);
      else setTilesUnavailable(true);
      const resume = () => { if (!map.hasLayer(tiles)) tiles.addTo(map); online(); };
      window.addEventListener('online', resume);
      window.addEventListener('offline', offline);
      tileTimer = setTimeout(() => { if (active && !loaded) setTilesUnavailable(true); }, 7000);
      resize = new ResizeObserver(() => { if (active) map.invalidateSize({ pan: false }); });
      resize.observe(host.current);
      setReady(true);
      return () => {
        active = false;
        clearTimeout(tileTimer);
        resize?.disconnect();
        window.removeEventListener('online', resume);
        window.removeEventListener('offline', offline);
        engine.current = null;
        map.remove();
      };
    } catch (e) {
      active = false;
      clearTimeout(tileTimer);
      resize?.disconnect();
      map?.remove();
      engine.current = null;
      setError(true);
    }
  // Coordinates are updated by the next effect without recreating the map.
  }, [validSchool, error]);

  useEffect(() => {
    const current = engine.current;
    if (!current || !validSchool || !ready) return;
    try {
      current.layers.clearLayers();
      const label = (text: string) => { const el = document.createElement('span'); el.textContent = text; return el; };
      const radius = L.circle([schoolLat, schoolLng], { radius: radiusMeters, color: '#b07800', fillColor: '#fbc02d', weight: 2, fillOpacity: .12, interactive: false }).addTo(current.layers);
      L.marker([schoolLat, schoolLng], { icon: L.divIcon({ className: 'gps-school-marker', html: '<span>S</span>', iconSize: [28, 28], iconAnchor: [14, 14] }), title: 'Titik sekolah', keyboard: true }).bindTooltip(label(schoolName || 'Sekolah'), { direction: 'top' }).addTo(current.layers);
      const bounds = radius.getBounds();
      if (validUser) {
        const point: [number, number] = [validUser.latitude, validUser.longitude];
        L.circle(point, { radius: validUser.accuracy, color: '#57534e', fillColor: '#a8a29e', weight: 1, dashArray: '4 4', fillOpacity: .08, interactive: false }).addTo(current.layers);
        L.marker(point, { icon: L.divIcon({ className: 'gps-user-marker', html: '<span>A</span>', iconSize: [26, 26], iconAnchor: [13, 13] }), title: 'Posisi GPS Anda terakhir', keyboard: true, zIndexOffset: 100 }).bindTooltip(label(`${provisional ? 'Perkiraan posisi Anda' : 'Posisi Anda'} · ±${Math.round(validUser.accuracy)} m`), { direction: 'top' }).addTo(current.layers);
        bounds.extend(point);
      }
      current.fit = () => current.map.fitBounds(bounds, { padding: [42, 38], maxZoom: 18, animate: false });
      current.fit();
    } catch { setError(true); }
  }, [ready, validSchool, schoolLat, schoolLng, radiusMeters, schoolName, validUser?.latitude, validUser?.longitude, validUser?.accuracy, provisional]);

  if (!validSchool || error) return <div className="gps-map-placeholder">{error ? 'Peta tidak tersedia. Informasi GPS dan presensi tetap dapat digunakan.' : 'Lokasi sekolah belum dikonfigurasi oleh admin.'}</div>;
  return <section className="gps-map-card" aria-label="Peta lokasi presensi">
    <div className="gps-map-heading"><div><h5>Peta lokasi presensi</h5><p>Radius sekolah {radiusMeters} m · {validUser ? 'Posisi GPS terakhir' : 'Menunggu posisi Anda'}</p></div></div>
    <div className="gps-map-frame">
      <div ref={host} className="gps-map-canvas" aria-label={`Peta ${schoolName}, radius ${radiusMeters} meter`} />
      <div className="gps-map-controls" aria-label="Kontrol peta">
        <button type="button" aria-label="Perbesar peta" disabled={!ready} onClick={() => engine.current?.map.zoomIn()}>+</button>
        <button type="button" aria-label="Perkecil peta" disabled={!ready} onClick={() => engine.current?.map.zoomOut()}>−</button>
        <button type="button" aria-label="Tampilkan sekolah dan posisi Anda" disabled={!ready} onClick={() => engine.current?.fit()}>◎</button>
      </div>
      {touch && <button type="button" className="gps-map-explore" aria-pressed={exploring} onClick={() => { const next = !exploring; setExploring(next); if (next) engine.current?.map.dragging.enable(); else engine.current?.map.dragging.disable(); }}>{exploring ? 'Selesai geser peta' : 'Geser peta'}</button>}
    </div>
    {tilesUnavailable && <div className="gps-map-notice" role="status">Latar peta belum tersedia. Periksa internet; penanda GPS tetap ditampilkan. <button type="button" className="gps-map-text-button" onClick={() => { const e = engine.current; if (e) { if (!e.map.hasLayer(e.tiles)) e.tiles.addTo(e.map); e.tiles.redraw(); } }}>Coba peta lagi</button></div>}
    <div className="gps-map-legend"><span><i className="gps-legend-school">S</i> Sekolah</span><span><i className="gps-legend-user">A</i> Anda{provisional ? ' (sementara)' : ''}</span><span><i className="gps-legend-radius" /> Batas presensi</span></div>
    <p className="gps-map-caption">Peta sebagai panduan. Validasi memakai koordinat GPS, akurasi, dan radius admin; titik peta tidak dapat dipindahkan.</p>
  </section>;
}
