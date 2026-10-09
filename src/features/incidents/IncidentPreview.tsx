import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Plus,
  Search,
  Filter,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Eye,
  Edit2,
  Trash2,
  Camera,
  MapPin,
  User,
  LayoutGrid,
  List,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { IncidentFormModal } from './IncidentFormModal';
import { IncidentDetailModal } from './IncidentDetailModal';
import { IncidentRecord, IncidentStatus, IncidentSeverity, getIncidentCategoryDisplay } from '../../types/incident.types';
import { IncidentCategoryRecord } from '../../types/master.types';
import { FirestoreService } from '../../services/firebase/firestoreService';
import { IncidentService } from '../../services/firebase/incidentService';
import { useAuth } from '../../contexts/AuthContext';
import { formatIndonesianDate } from '../../utils/dateUtils';

export const IncidentPreview: React.FC = () => {
  const { currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');

  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [categories, setCategories] = useState<IncidentCategoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Views
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('SEMUA');
  const [categoryFilter, setCategoryFilter] = useState<string>('SEMUA');
  const [severityFilter, setSeverityFilter] = useState<string>('SEMUA');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingIncident, setEditingIncident] = useState<IncidentRecord | null>(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailIncident, setDetailIncident] = useState<IncidentRecord | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<IncidentRecord | null>(null);

  // Load Subscriptions
  useEffect(() => {
    IncidentService.bootstrapIfEmpty().then(() => {
      setIsLoading(false);
    });

    const unsubInc = FirestoreService.subscribeToCollection<IncidentRecord>('incidents', (data) => {
      setIncidents(
        data.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())
      );
    });

    const unsubCat = FirestoreService.subscribeToCollection<IncidentCategoryRecord>('incidentCategories', (data) => {
      setCategories(data);
    });

    return () => {
      unsubInc();
      unsubCat();
    };
  }, []);

  // Save / Update
  const handleSaveIncident = async (record: IncidentRecord) => {
    if (!currentUser) return;
    await IncidentService.saveIncident(record, currentUser);
  };

  // Status Change
  const handleStatusChange = async (
    incidentId: string,
    newStatus: IncidentStatus,
    note?: string
  ) => {
    if (!currentUser) return;
    await IncidentService.updateIncidentStatus(incidentId, newStatus, currentUser, note);
  };

  // Delete
  const handleDeleteIncident = async () => {
    if (!deleteConfirm || !currentUser) return;
    await IncidentService.deleteIncident(deleteConfirm.id, currentUser);
    setDeleteConfirm(null);
  };

  // Metrics
  const totalCount = incidents.length;
  const criticalCount = incidents.filter((i) => i.tingkatKeparahan === 'KRITIS' || i.tingkatKeparahan === 'TINGGI').length;
  const inProgressCount = incidents.filter((i) => i.status === 'INVESTIGASI' || i.status === 'PENANGANAN' || i.status === 'BARU').length;
  const resolvedCount = incidents.filter((i) => i.status === 'SELESAI').length;

  const filtered = incidents.filter((i) => {
    const matchStatus = statusFilter === 'SEMUA' || i.status === statusFilter;
    const matchCat = categoryFilter === 'SEMUA' || i.kategori === categoryFilter;
    const matchSev = severityFilter === 'SEMUA' || i.tingkatKeparahan === severityFilter;
    const matchSearch =
      i.uraian.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.lokasi.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.pihakTerlibat.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getIncidentCategoryDisplay(i).toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.kategoriName.toLowerCase().includes(searchQuery.toLowerCase());

    return matchStatus && matchCat && matchSev && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            Laporan Kejadian & Insiden Sekolah
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pencatatan insiden ketertiban siswa, fasilitas sarpras, keamanan gerbang, dan rekam medis UKS
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => {
            setEditingIncident(null);
            setIsFormModalOpen(true);
          }}
        >
          + Lapor Kejadian Baru
        </Button>
      </div>

      {/* METRIC SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Insiden</span>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">{totalCount} Laporan</div>
            <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mt-1">Tercatat di Database</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Kritis & Tinggi</span>
            <div className="text-xl font-bold text-rose-600 mt-1">{criticalCount} Kasus</div>
            <div className="text-[11px] text-rose-500 font-medium mt-1">Prioritas Penanganan</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Dalam Penanganan</span>
            <div className="text-xl font-bold text-amber-600 mt-1">{inProgressCount} Kasus</div>
            <div className="text-[11px] text-amber-500 font-medium mt-1">Proses Investigasi/Tindak Lanjut</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Selesai Ditangani</span>
            <div className="text-xl font-bold text-emerald-600 mt-1">{resolvedCount} Kasus</div>
            <div className="text-[11px] text-emerald-500 font-medium mt-1">Kasus Ditutup & Tuntas</div>
          </CardContent>
        </Card>
      </div>

      {/* SEARCH & FILTERS BAR */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
            <div className="relative w-full lg:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari uraian, siswa, atau lokasi..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-between lg:justify-end">
              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="SEMUA">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Severity Filter */}
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="SEMUA">Semua Tingkat</option>
                <option value="RENDAH">Rendah</option>
                <option value="SEDANG">Sedang</option>
                <option value="TINGGI">Tinggi</option>
                <option value="KRITIS">Kritis</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="SEMUA">Semua Status</option>
                <option value="BARU">BARU</option>
                <option value="INVESTIGASI">INVESTIGASI</option>
                <option value="PENANGANAN">PENANGANAN</option>
                <option value="SELESAI">SELESAI</option>
              </select>

              {/* View Switch */}
              <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-xl p-1 bg-slate-50 dark:bg-slate-900">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-white dark:bg-slate-800 shadow-xs text-blue-600' : 'text-slate-400'}`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'table' ? 'bg-white dark:bg-slate-800 shadow-xs text-blue-600' : 'text-slate-400'}`}
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* INCIDENT VIEW: GRID */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length > 0 ? (
            filtered.map((item) => (
              <Card key={item.id} hoverable className="transition-all">
                <CardContent className="p-5 space-y-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                      {getIncidentCategoryDisplay(item)}
                    </span>
                    <Badge
                      variant={
                        item.tingkatKeparahan === 'KRITIS'
                          ? 'danger'
                          : item.tingkatKeparahan === 'TINGGI'
                          ? 'warning'
                          : 'info'
                      }
                      size="sm"
                    >
                      {item.tingkatKeparahan}
                    </Badge>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">
                      {item.uraian}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                      <span className="truncate">{item.lokasi}</span>
                    </p>
                  </div>

                  <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span>{formatIndonesianDate(item.tanggal)}</span>
                      <span>{item.waktu} WIB</span>
                    </div>
                    <div className="text-[11px] truncate">
                      Pihak: <strong>{item.pihakTerlibat}</strong>
                    </div>
                  </div>

                  {/* Actions & Status */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Badge
                      variant={
                        item.status === 'SELESAI'
                          ? 'success'
                          : item.status === 'PENANGANAN'
                          ? 'warning'
                          : 'primary'
                      }
                      size="sm"
                    >
                      {item.status}
                    </Badge>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        leftIcon={<Eye className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setDetailIncident(item);
                          setIsDetailModalOpen(true);
                        }}
                      >
                        Detail
                      </Button>
                      {isAdmin && (
                        <button
                          onClick={() => setDeleteConfirm(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full py-16 text-center text-slate-400 space-y-2">
              <AlertTriangle className="w-12 h-12 mx-auto opacity-30" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Tidak ada laporan kejadian untuk filter ini
              </h4>
              <p className="text-xs">Klik tombol "+ Lapor Kejadian Baru" untuk menambahkan catatan insiden.</p>
            </div>
          )}
        </div>
      ) : (
        /* TABLE VIEW */
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                <tr>
                  <th className="p-4">Waktu</th>
                  <th className="p-4">Kategori</th>
                  <th className="p-4">Uraian Kejadian</th>
                  <th className="p-4">Lokasi & Pihak</th>
                  <th className="p-4">Tingkat</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {item.tanggal} <span className="text-[11px] text-slate-400">{item.waktu}</span>
                    </td>
                    <td className="p-4 font-bold text-slate-900 dark:text-white">
                      {getIncidentCategoryDisplay(item)}
                    </td>
                    <td className="p-4 text-slate-800 dark:text-slate-200 max-w-xs truncate">
                      {item.uraian}
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-400">
                      <div>{item.lokasi}</div>
                      <div className="text-[10px] italic">{item.pihakTerlibat}</div>
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={item.tingkatKeparahan === 'KRITIS' ? 'danger' : item.tingkatKeparahan === 'TINGGI' ? 'warning' : 'info'}
                        size="sm"
                      >
                        {item.tingkatKeparahan}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={item.status === 'SELESAI' ? 'success' : item.status === 'PENANGANAN' ? 'warning' : 'primary'}
                        size="sm"
                      >
                        {item.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            setDetailIncident(item);
                            setIsDetailModalOpen(true);
                          }}
                        >
                          Detail
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* FORM MODAL */}
      <IncidentFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingIncident(null);
        }}
        onSave={handleSaveIncident}
        editingIncident={editingIncident}
        categories={categories}
      />

      {/* DETAIL MODAL */}
      <IncidentDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setDetailIncident(null);
        }}
        incident={detailIncident}
        onStatusChange={handleStatusChange}
        onEdit={(inc) => {
          setEditingIncident(inc);
          setIsFormModalOpen(true);
        }}
      />

      {/* DELETE CONFIRM MODAL */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Hapus Laporan Kejadian"
        maxWidth="sm"
      >
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Hapus Laporan Ini?
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              {getIncidentCategoryDisplay(deleteConfirm)} • {deleteConfirm?.lokasi}
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>
              Batal
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeleteIncident}>
              Ya, Hapus
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
