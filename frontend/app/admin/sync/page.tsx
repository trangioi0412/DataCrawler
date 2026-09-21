import { ManufacturerSyncPanel } from "@/components/sync/ManufacturerSyncPanel";
import { ManufacturerRequestForm } from "@/components/sync/ManufacturerRequestForm";

export const metadata = {
  title: "Manufacturer Data Sync",
};

export default function SyncAdminPage() {
  return (
    <main className="min-h-screen flex flex-col items-center gap-8 p-8 sm:p-16">
      <ManufacturerSyncPanel />
      <ManufacturerRequestForm />
    </main>
  );
}
