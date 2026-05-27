import { ShimmerButton } from "@/components/ui/shimmer-button";
import { Badge } from "@/components/ui/badge";

export function HeroSection() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
      <Badge variant="outline" className="border-violet-800/80 text-violet-200">
        LLM Supply Chain Protection
      </Badge>
      <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-zinc-100 sm:text-5xl">
        Files can attack your AI.{" "}
        <span className="gradient-text">Blacklight stops them first.</span>
      </h1>
      <p className="mt-4 max-w-3xl text-lg text-zinc-300/90">
        Scan PDFs and images for hidden prompt injections before they reach LLMs
        with PDF parsing, OCR, and hybrid AI analysis.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ShimmerButton
          className="h-10 px-5"
          onClick={() => {
            window.location.hash = "scanner";
          }}
        >
          Scan a document
        </ShimmerButton>
        <Badge
          variant="outline"
          className="h-10 border-zinc-700 px-4 text-zinc-300"
        >
          Unsafe for RAG ingestion detection
        </Badge>
      </div>
    </section>
  );
}
