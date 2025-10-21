import "./globals.css";
import Navbar from "@/components/Navbar";
import { SupabaseProvider } from "@/components/SupabaseProvider";

export const metadata = {
  title: "Jaguar Track Lost & Found",
  description: "University of Belize Lost & Found Management System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-300">
        <SupabaseProvider>
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 transition-colors duration-300">
            {children}
          </main>
        </SupabaseProvider>
      </body>
    </html>
  );
}
