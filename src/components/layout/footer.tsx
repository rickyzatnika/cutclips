import { InstallAppButton } from "../install-app-button";

export function Footer() {
  return (
    <footer className="border-t border-white/10 py-6">
      <InstallAppButton />
      <div className="mx-auto max-w-7xl px-4 text-center text-sm text-zinc-500">
        &copy; {new Date().getFullYear()} CutClips. All rights reserved.
      </div>
    </footer>
  );
}
