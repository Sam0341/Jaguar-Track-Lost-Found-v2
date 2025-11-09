import "./globals.css";
import Navbar from "@/components/Navbar";
import { SupabaseProvider } from "@/components/SupabaseProvider";

export const metadata = {
  title: "Jaguar Track Lost & Found",
  description: "University of Belize Lost & Found Management System",
  icons: {
    icon: "/logo.png", // ✅ your logo file inside /public
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-all duration-500 ease-in-out overflow-x-hidden">
        <SupabaseProvider>
          {/* ✅ Navbar appears ONCE globally */}
          <Navbar />
          <div id="app-root" className="relative z-0">
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 transition-colors duration-300">
              {children}
            </main>
          </div>
        </SupabaseProvider>
      </body>
    </html>
  );
}
