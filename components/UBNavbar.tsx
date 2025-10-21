
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PackageSearch } from 'lucide-react';

export function UBNavbar() {
  const nav = [
    { href: '/', label: 'Home' },
    { href: '/items', label: 'Items' },
    { href: '/report/lost', label: 'Report Lost' },
    { href: '/report/found', label: 'Report Found' },
    { href: '/reports', label: 'Reports' },
  ];
  const pathname = usePathname();
  return (
    <header className="border-b bg-white sticky top-0 z-50">
      <div className="container py-3 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 text-ubBlue font-bold">
          <PackageSearch /> <span>UB Lost & Found</span>
        </Link>
        <nav className="ml-auto flex gap-2">
          {nav.map(n => (
            <Link key={n.href} href={n.href} className={`px-3 py-2 rounded-2xl text-sm ${pathname===n.href ? 'bg-ubBlue text-white' : 'hover:bg-gray-100'}`}>
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
