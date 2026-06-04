import Link from "next/link";
import { Sparkles } from "lucide-react";

const footerLinks = [
  {
    title: "Produk",
    links: [
      { label: "Fitur", href: "/#features" },
      { label: "Harga", href: "/pricing" },
      { label: "Cara Kerja", href: "/#how-it-works" },
    ],
  },
  {
    title: "Perusahaan",
    links: [
      { label: "Blog", href: "#" },
      { label: "Kontak", href: "#" },
      { label: "Karir", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privasi", href: "#" },
      { label: "Syarat & Ketentuan", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-surface-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary-600" />
              <span className="text-base font-bold text-surface-900">
                ShortAI
              </span>
            </Link>
            <p className="mt-3 text-sm text-surface-500">
              Ubah video panjang jadi short viral dengan kecerdasan AI.
            </p>
          </div>
          {footerLinks.map((group) => (
            <div key={group.title}>
              <h4 className="mb-3 text-sm font-semibold text-surface-900">
                {group.title}
              </h4>
              <ul className="space-y-2">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-surface-500 transition-colors hover:text-primary-600"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-8 border-t border-surface-100 pt-6 text-center text-sm text-surface-400">
          &copy; {new Date().getFullYear()} ShortAI. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
