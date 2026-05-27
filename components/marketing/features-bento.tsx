"use client";

import {
  FileText,
  ScanEye,
  Sparkles,
  ShieldCheck,
  Gauge,
  Plug,
} from "lucide-react";
import {
  RadialOrbitalTimeline,
  type TimelineItem,
} from "@/components/ui/radial-orbital-timeline";

const timelineData: TimelineItem[] = [
  {
    id: 1,
    title: "PDF extraction",
    date: "Layer 1",
    content:
      "Reads text under visual covers and hidden instruction layers in PDF uploads.",
    category: "Ingestion",
    icon: FileText,
    relatedIds: [2],
    status: "completed",
    energy: 95,
  },
  {
    id: 2,
    title: "OCR + obfuscation",
    date: "Layer 2",
    content:
      "Detects image-only attacks and white-cover concealment signals before LLM access.",
    category: "Vision",
    icon: ScanEye,
    relatedIds: [1, 3],
    status: "completed",
    energy: 88,
  },
  {
    id: 3,
    title: "Hybrid LLM",
    date: "Layer 3",
    content:
      "Classifies prompt injection intent with evidence-backed summaries and attack typing.",
    category: "Analysis",
    icon: Sparkles,
    relatedIds: [2, 4],
    status: "in-progress",
    energy: 92,
  },
  {
    id: 4,
    title: "Sanitized output",
    date: "Layer 4",
    content:
      "Produces clean text safe for RAG pipelines and chat ingestion workflows.",
    category: "Remediation",
    icon: ShieldCheck,
    relatedIds: [3, 5],
    status: "completed",
    energy: 90,
  },
  {
    id: 5,
    title: "Risk scoring",
    date: "Layer 5",
    content:
      "Surfaces confidence, attack type, severity, and layered scan logs for operators.",
    category: "Telemetry",
    icon: Gauge,
    relatedIds: [4, 6],
    status: "completed",
    energy: 85,
  },
  {
    id: 6,
    title: "Supply-chain gate",
    date: "Layer 6",
    content:
      "Drop-in pre-ingestion firewall before files reach models, agents, or vector stores.",
    category: "Deploy",
    icon: Plug,
    relatedIds: [5],
    status: "pending",
    energy: 80,
  },
];

export function FeaturesBento() {
  return (
    <section id="features" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
      <p className="section-label">Features</p>
      <h2 className="section-title mt-3">
        Security-first AI ingestion stack
      </h2>
      <p className="section-copy mt-2">
        Built for teams shipping RAG and agent workflows that can&apos;t trust
        incoming files by default. Click a node to explore each layer.
      </p>
      <div className="mt-10">
        <RadialOrbitalTimeline
          timelineData={timelineData}
          className="h-[min(560px,70vh)] min-h-[420px]"
        />
      </div>
    </section>
  );
}
