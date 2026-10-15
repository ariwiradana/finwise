import Link from 'next/link';
import { ArrowUpRight, CirclePlus, Construction, FileText } from 'lucide-react';

export function ModulePage({ title, description, status, features }: { title: string; description: string; status: string; features: string[] }) {
  return <>
    <div className="page-heading"><div><h1>{title}</h1><div className="muted">{description}</div></div><span className="badge amber">Dalam cakupan build</span></div>
    <div className="section-grid">
      <section className="card"><div className="section-title"><h2>Ringkasan modul</h2><Construction size={17} color="#9a772f"/></div><div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{status}</div><p className="muted" style={{ lineHeight: 1.7 }}>Fondasi antarmuka sudah disiapkan. Modul ini akan dihubungkan ke database cloud dan ledger setelah konfigurasi database serta autentikasi ditetapkan.</p><div style={{ marginTop: 18, display: 'grid', gap: 12 }}>{features.map(feature => <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: '#454b53' }}><span style={{ width: 6, height: 6, borderRadius: 99, background: '#78a78a' }}/>{feature}</div>)}</div></section>
      <section className="card"><div className="section-title"><h2>Aksi cepat</h2><CirclePlus size={17} color="#6f7780"/></div><div style={{ display: 'grid', gap: 9 }}><Link href="/transactions" className="secondary-btn" style={{ justifyContent: 'space-between' }}>Buka transaksi <ArrowUpRight size={14}/></Link><Link href="/reports" className="secondary-btn" style={{ justifyContent: 'space-between' }}>Lihat laporan <ArrowUpRight size={14}/></Link><Link href="/import-export" className="secondary-btn" style={{ justifyContent: 'space-between' }}>Impor / ekspor data <FileText size={14}/></Link></div><div style={{ borderTop: '1px solid #eff0f2', marginTop: 20, paddingTop: 15 }}><div className="muted" style={{ lineHeight: 1.6 }}>Catatan: ini bukan data contoh finansial sungguhan. Modul tidak akan menampilkan saldo atau nilai buatan.</div></div></section>
    </div>
  </>;
}
