import { Separator } from "@/components/ui/separator";

const steps = [
  {
    title: "Upload",
    body: "Drop PDFs, text files, or screenshots before they touch your LLM pipeline.",
  },
  {
    title: "Analyze",
    body: "Blacklight runs layered extraction and prompt injection heuristics + AI classification.",
  },
  {
    title: "Sanitize",
    body: "Threats are highlighted, explained, and removed from final LLM-safe output.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6"
    >
      <p className="section-label">How it works</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">
        Three-step security gate before AI ingestion
      </h2>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {steps.map((step, idx) => (
          <div
            key={step.title}
            className="rounded-2xl border border-zinc-800/80 bg-zinc-950/75 p-6"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Step {idx + 1}
            </p>
            <h3 className="mt-2 text-xl font-semibold text-zinc-100">
              {step.title}
            </h3>
            <Separator className="my-3 bg-zinc-800" />
            <p className="text-sm text-zinc-400">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
