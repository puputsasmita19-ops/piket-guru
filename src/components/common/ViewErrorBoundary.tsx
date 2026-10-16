import React from 'react';

interface Props { children: React.ReactNode; resetKey: string; onGoHome?: () => void }
interface State { failed: boolean }

/** Keeps the header/navigation usable when one feature or its downloaded chunk fails. */
export class ViewErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State { return { failed: true }; }
  componentDidCatch(error: Error) {
    console.error('[VIEW] Halaman gagal dimuat:', error.name, error.message);
  }
  componentDidUpdate(previous: Props) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="mx-auto max-w-md p-6 text-center space-y-4 text-slate-800 dark:text-slate-100">
        <h2 className="text-base font-bold">Halaman belum dapat dibuka</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Periksa koneksi internet Anda. Jika aplikasi baru diperbarui, muat ulang untuk mengambil versi terbaru.</p>
        <div className="flex flex-wrap justify-center gap-2">
          {this.props.onGoHome && <button type="button" onClick={this.props.onGoHome} className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm">Kembali ke dashboard</button>}
          <button type="button" onClick={() => window.location.reload()} className="rounded-xl px-4 py-2 text-sm font-semibold bg-[var(--theme-primary)] text-[var(--theme-primary-contrast)]">Muat ulang aplikasi</button>
        </div>
      </div>
    );
  }
}
