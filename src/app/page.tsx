import type { Metadata } from "next";
import AIPostBuilder from "@/components/ai-post-builder";

export const metadata: Metadata = {
  title: "AI Social Media Post Builder",
  description: "Generate social media posts with AI based on your descriptions",
};

export default function HomePage() {
  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="flex flex-col items-center space-y-4 text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
          AI Social Media Post Builder
        </h1>
        <p className="max-w-[700px] md:text-xl/relaxed">
          Describe your post idea, and our AI will generate content for your
          favorite social platforms.
        </p>
      </div>
      <AIPostBuilder />
    </div>
  );
}
