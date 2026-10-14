import React from "react";
import { SectionHeading } from "@/components/section-heading";
import { ReviewWorkspace } from "@/components/review-workspace";

export default function ReviewPage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        title="Interactive Concept Review"
        subtitle="Adaptive spaced repetition engine designed to strengthen your long-term concept retention"
      />

      <ReviewWorkspace />
    </div>
  );
}
