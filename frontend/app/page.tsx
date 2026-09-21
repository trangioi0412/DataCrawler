import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Manufacturer Data Sync Engine</h1>
      <p className="text-black/60 dark:text-white/60 max-w-md">
        Collect, normalize, and sync AV product catalogs from multiple manufacturers.
      </p>
      <Link
        href="/admin/sync"
        className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        Open Sync Admin
      </Link>
    </main>
  );
}
