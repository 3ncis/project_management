import type { Metadata } from 'next';
import { DM_Sans, Manrope } from 'next/font/google';
import './globals.css';
import './production.css';

const bodyFont = DM_Sans({ variable: '--font-body', subsets: ['latin'] });
const displayFont = Manrope({ variable: '--font-display', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://padma-shri-ai-job-seeker.houseofsorashop.chatgpt.site'),
  title: 'Padma Shri Teknologi — AI Tender & PL Dashboard',
  description: 'Dashboard pencarian peluang Tender dan Pengadaan Langsung berbasis AI untuk Padma dan Ortyd, dengan monitoring khusus Admin.',
  openGraph: { title: 'Padma Shri Teknologi', description: 'AI Tender & PL Opportunity Dashboard', type: 'website', images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Padma Shri Teknologi AI Tender dan PL Opportunity Dashboard' }] },
  twitter: { card: 'summary_large_image', title: 'Padma Shri Teknologi', description: 'AI Tender & PL Opportunity Dashboard', images: ['/og.png'] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body className={`${bodyFont.variable} ${displayFont.variable}`}>{children}</body></html>;
}
