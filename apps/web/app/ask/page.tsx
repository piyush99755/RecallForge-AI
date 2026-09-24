import React from "react";
import { SectionHeading } from "@/components/section-heading";
import { AskWorkspace } from "@/components/ask-workspace";

export default function AskPage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        title="Ask RecallForge AI"
        subtitle="Grounded natural-language Q&A across your technical documents, code, and project notes"
      />

      <AskWorkspace />
    </div>
  );
}
