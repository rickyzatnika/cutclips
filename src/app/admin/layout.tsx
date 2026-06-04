import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminGuard } from "@/components/admin/admin-guard";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <div className="flex min-h-screen">
        <AdminSidebar />
        <main className="flex-1 overflow-auto bg-surface-50">{children}</main>
      </div>
    </AdminGuard>
  );
}
