import { AdminGuard } from "@/components/admin/admin-guard";
import { InvoicesListClient } from "./InvoicesListClient";

export default function AdminInvoicesPage() {
  return (
    <AdminGuard>
      <div className="p-6">
        <InvoicesListClient />
      </div>
    </AdminGuard>
  );
}