import React from "react";
import { SectionHeading } from "@/components/section-heading";
import { ProgressWorkspace } from "@/components/progress-workspace";

export default function ProgressPage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        title="Learning Progress & Analytics"
        subtitle="Track concept mastery trajectories, retention metrics, and recurring knowledge gaps"
      />

      <ProgressWorkspace />
    </div>
  );
}
