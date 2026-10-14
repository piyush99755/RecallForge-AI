import React from "react";
import { SectionHeading } from "@/components/section-heading";
import { ChallengesWorkspace } from "@/components/challenges-workspace";

export default function ChallengesPage() {
  return (
    <div className="space-y-6">
      <SectionHeading
        title="Study Challenges & Quizzes"
        subtitle="AI-generated technical scenarios, diagnostic questions, and code review challenges"
      />

      <ChallengesWorkspace />
    </div>
  );
}
