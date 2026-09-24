import React from "react";
import { SectionHeading } from "@/components/section-heading";
import { LibraryWorkspace } from "@/components/library-workspace";

export default function LibraryPage() {
  return (
    <div className="space-y-8">
      <SectionHeading
        title="Study Library"
        subtitle="Upload journals, notes, and study documents to make them searchable and reviewable in RecallForge."
      />

      <LibraryWorkspace />
    </div>
  );
}
