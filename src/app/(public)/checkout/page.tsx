import { Suspense } from "react";
import Link from "next/link";
import {  Loader2 } from "lucide-react";
import { CheckoutClient } from "./CheckoutClient";

export default function CheckoutPage() {
  return (
    <div className="px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/pricing" className="mb-6 inline-flex items-center gap-2 text-sm text-surface-500 hover:text-primary-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Kembali ke Harga
        </Link>
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        }>
          <CheckoutClient />
        </Suspense>
      </div>
    </div>
  );
}