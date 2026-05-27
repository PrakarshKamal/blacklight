import {
  BentoCard,
  BentoGrid,
} from "@/components/ui/bento-grid";

const features = [
  {
    title: "PDF text-layer extraction",
    body: "Reads text under visual covers and hidden instruction layers.",
    featured: true,
  },
  {
    title: "OCR + obfuscation detection",
    body: "Catches image-only attacks and white-cover concealment signals.",
  },
  {
    title: "Hybrid LLM analysis",
    body: "Classifies prompt injection intent with evidence-backed summaries.",
  },
  {
    title: "Sanitized output",
    body: "Generates clean text that is safe for RAG and chat ingestion.",
  },
  {
    title: "Risk scoring",
    body: "Shows confidence, attack type, severity, and layered scan logs.",
  },
  {
    title: "Supply-chain ready",
    body: "Works as a pre-ingestion AI firewall layer before model access.",
  },
];

export function FeaturesBento() {
  return (
    <section id="features" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
      <p className="section-label">Features</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">
        Security-first AI ingestion stack
      </h2>
      <p className="mt-2 max-w-2xl text-zinc-400">
        Built for teams shipping RAG and agent workflows that can&apos;t trust
        incoming files by default.
      </p>
      <BentoGrid className="mt-8">
        {features.map((feature) => (
          <BentoCard key={feature.title} featured={feature.featured}>
            <p className="text-sm text-violet-300/90">Blacklight</p>
            <h3 className="mt-2 text-lg font-semibold text-zinc-100">
              {feature.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              {feature.body}
            </p>
          </BentoCard>
        ))}
      </BentoGrid>
    </section>
  );
}
