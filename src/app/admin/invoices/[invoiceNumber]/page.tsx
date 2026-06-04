import { notFound } from "next/navigation";
import { AdminGuard } from "@/components/admin/admin-guard";
import { InvoiceDetailClient } from "./InvoiceDetailClient";

export default async function AdminInvoicePage({ params }: { params: Promise<{ invoiceNumber: string }> }) {
  const { invoiceNumber } = await params;

  return (
    <AdminGuard>
      <div className="px-6 py-8">
        <InvoiceDetailClient invoiceNumber={invoiceNumber} />
      </div>
    </AdminGuard>
  );
}