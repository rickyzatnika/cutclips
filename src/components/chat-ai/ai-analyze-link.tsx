"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import UpgradeModal from "@/components/ui/upgrade-modal";

interface Props {
  className?: string;
  children: React.ReactNode;
}

export function AiAnalyzeLink({ className, children }: Props) {
  const { data: session } = useSession();
  const user = useQuery(
    api.users.getByEmail,
    session?.user?.email ? { email: session.user.email } : "skip",
  );
  const [showUpgrade, setShowUpgrade] = useState(false);

  const isPaid = user != null && (user.credits + (user.totalCreditsUsed ?? 0)) > 100;

  const handleClick = (e: React.MouseEvent) => {
    if (!isPaid) {
      e.preventDefault();
      setShowUpgrade(true);
    }
  };

  return (
    <>
      <Link href="/chat-ai" onClick={handleClick} className={className}>
        {children}
      </Link>
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </>
  );
}
