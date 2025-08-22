// app/layout.tsx
"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next"


export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <html lang="en">
      <body>
        <QueryClientProvider client={client}>
          {children}
                  <Analytics />
          <Toaster position="top-right" />
        </QueryClientProvider>
      </body>
    </html>
  );
}
