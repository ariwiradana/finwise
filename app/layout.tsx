import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppShell } from '@/components/app-shell';
import { Toaster } from 'sonner';
export const metadata: Metadata = {
  title: 'Finwise — Personal Finance',
  description: 'Personal finance management, budgeting, assets, and financial health.',
  applicationName: 'Finwise',
  manifest: '/manifest.json',
};
export const viewport: Viewport = { themeColor: '#173b2b', width: 'device-width', initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body><AppShell>{children}</AppShell><Toaster richColors position="top-right" /></body></html>;
}
