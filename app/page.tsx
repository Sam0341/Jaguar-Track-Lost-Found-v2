import Link from 'next/link'
import { ArrowRight, Camera, MapPin, Search, BarChart2 } from 'lucide-react'

export default function HomePage() {
  const features = [
    {
      icon: <Search />,
      title: 'Browse Items',
      desc: 'Search and filter lost & found items across UB campuses.',
      href: '/items',
    },
    {
      icon: <Camera />,
      title: 'Report Item',
      desc: 'Log a lost or found item with photos and contact info.',
      href: '/report', // updated to combined page
    },
    {
      icon: <BarChart2 />,
      title: 'Reports',
      desc: 'View recovery rates, common categories, and trends.',
      href: '/reports',
    },
  ]

  return (
    <div className="space-y-8">
      <section className="card p-8 bg-gradient-to-br from-white to-yellow-50">
        <h1 className="text-3xl md:text-4xl font-bold text-ubBlue">UB Lost & Found</h1>
        <p className="mt-3 text-gray-700 max-w-2xl">
          A centralized, user-friendly platform for students and staff at the University of Belize
          to report, track, and recover misplaced items.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="btn btn-primary" href="/items">
            Browse Items
          </Link>
          <Link className="btn btn-secondary" href="/report">
            Report Item
          </Link>
        </div>
      </section>

      <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((f) => (
          <Link
            key={f.title}
            href={f.href}
            className="card p-5 hover:shadow-md transition"
          >
            <div className="h-10 w-10">{f.icon}</div>
            <h3 className="mt-3 font-semibold">{f.title}</h3>
            <p className="text-sm text-gray-600">{f.desc}</p>
            <div className="mt-4 text-ubBlue inline-flex items-center gap-1 text-sm">
              Explore <ArrowRight size={16} />
            </div>
          </Link>
        ))}
      </section>
    </div>
  )
}
