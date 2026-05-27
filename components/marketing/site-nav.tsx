"use client";

import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import { ShimmerButton } from "@/components/ui/shimmer-button";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="overflow-hidden rounded-lg ring-1 ring-zinc-700/80">
            <Image
              src="/branding/blacklight-logo.png"
              alt="Blacklight logo"
              width={34}
              height={34}
              className="h-8 w-8 object-cover sm:h-[34px] sm:w-[34px]"
              priority
            />
          </div>
          <div>
            <p className="font-semibold tracking-tight text-zinc-100">Blacklight</p>
            <p className="text-xs text-zinc-500">AI firewall for file uploads</p>
          </div>
        </div>

        <nav className="hidden items-center gap-6 text-sm text-zinc-300 md:flex">
          <a href="#features" className="hover:text-zinc-100">
            Features
          </a>
          <a href="#how-it-works" className="hover:text-zinc-100">
            How it works
          </a>
          <a href="#scanner" className="hover:text-zinc-100">
            Live scanner
          </a>
        </nav>

        <ShimmerButton asChild className="h-9 px-4 text-sm">
          <a href="#scanner">
            <ShieldCheck className="mr-1.5 h-4 w-4" />
            Scan now
          </a>
        </ShimmerButton>
      </div>
    </header>
  );
}
