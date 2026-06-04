"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useUser } from "@/providers/auth";
import { signOut } from "next-auth/react";

const navLinks = [
  { href: "/#features", label: "Fitur" },
  { href: "/#how-it-works", label: "Cara Kerja" },
  { href: "/pricing", label: "Harga" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, isLoading } = useUser();

  return (
    <header className="sticky top-0 z-50 border-b border-surface-200/80 bg-white/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary-600" />
          <span className="text-lg font-bold text-surface-900">ShortAI</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-surface-600 transition-colors hover:text-primary-600"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {isLoading ? (
            <div className="h-8 w-20 animate-pulse rounded-lg bg-surface-200" />
          ) : user ? (
            <>
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={() => signOut()}>
                Keluar
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Masuk
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">Daftar Gratis</Button>
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="flex items-center p-2 md:hidden"
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        className={cn(
          "overflow-hidden border-t border-surface-200 transition-all duration-300 md:hidden",
          open ? "max-h-80" : "max-h-0",
        )}
      >
        <div className="space-y-2 px-4 py-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-surface-600 transition-colors hover:bg-surface-100 hover:text-primary-600"
            >
              {link.label}
            </Link>
          ))}
          <hr className="my-3 border-surface-200" />
          {user ? (
            <>
              <Link href="/dashboard" onClick={() => setOpen(false)}>
                <Button variant="outline" className="w-full" size="sm">
                  Dashboard
                </Button>
              </Link>
              <Button variant="outline" className="w-full" size="sm" onClick={() => { setOpen(false); signOut(); }}>
                Keluar
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setOpen(false)}>
                <Button variant="outline" className="w-full" size="sm">
                  Masuk
                </Button>
              </Link>
              <Link href="/signup" onClick={() => setOpen(false)}>
                <Button className="w-full" size="sm">
                  Daftar Gratis
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
