"use client";

import "./globals.css";
import Link from "next/link";
import { ReactNode } from "react";
import { LogOut } from "lucide-react";
import InvoiceParserIcon from "../components/invoice-parser-icon";
import { signOut, useSession, SessionProvider } from "next-auth/react";

function Header() {
  const { data: session } = useSession();

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 font-bold text-xl text-gray-900 hover:text-gray-700 transition-colors">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <InvoiceParserIcon className="w-5 h-5 text-white" />
          </div>
          Invoice Parser
        </Link>

        {session && (
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
              {session.user?.email}
            </div>
            <button
              onClick={async () => {
                try {
                  await signOut({ callbackUrl: '/login' });
                  // Force a page reload to clear any cached state
                  window.location.href = '/login';
                } catch (error) {
                  console.error('Logout error:', error);
                  // Fallback: force redirect
                  window.location.href = '/login';
                }
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <title>Invoice Parser</title>
        <script
          src={`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js`}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';`
          }}
        />
      </head>
      <body className="min-h-screen bg-gray-50">
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
