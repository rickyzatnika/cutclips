import { InstallAppButton } from "../install-app-button";

export function Footer() {
  return (
    <footer className="border-t border-white/10 pt-6 pb-24 sm:pb-6">
      <div className="mx-auto max-w-7xl px-4 text-center text-sm text-zinc-500 flex flex-col items-center gap-4">
        <InstallAppButton />
        <p>&copy; {new Date().getFullYear()} CutClips. All rights reserved.</p>
      </div>
    </footer>
  );
}
