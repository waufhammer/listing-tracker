import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-screen bg-white">
      <h1 className="text-3xl font-semibold text-black mb-4">Aufhammer Homes</h1>
      <p className="text-gray-500 mb-8">Listing Activity Tracker</p>
      <Link
        href="/admin"
        className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
      >
        Admin Login
      </Link>
    </div>
  );
}
