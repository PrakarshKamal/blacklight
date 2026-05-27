import { GridBackground } from "@/components/ui/grid-background";
import { SiteNav } from "@/components/marketing/site-nav";
import { HeroSection } from "@/components/marketing/hero-section";
import { FeaturesBento } from "@/components/marketing/features-bento";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ScannerWorkspace } from "@/components/scanner/scanner-workspace";

export function PageShell() {
  return (
    <div className="page-shell text-zinc-100">
      <GridBackground>
        <SiteNav />
        <main>
          <HeroSection />
          <FeaturesBento />
          <HowItWorks />
          <ScannerWorkspace />
        </main>
        <SiteFooter />
      </GridBackground>
    </div>
  );
}
