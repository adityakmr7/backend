import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'JobPilot', template: '%s | JobPilot' },
  description: 'Automated job application engine for YC-backed companies',
  keywords: ['job automation', 'YC companies', 'job search', 'AI cover letter'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>
        <div className="app-shell">
          <Sidebar />
          <div className="main-area">
            <Topbar />
            <main className="page-content animate-in" id="main-content" role="main">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
