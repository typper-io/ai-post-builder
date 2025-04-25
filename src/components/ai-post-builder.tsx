/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Download,
  Sparkles,
  RefreshCw,
  Instagram,
  Facebook,
  Twitter,
  Upload,
} from "lucide-react";
import OpenAI, { toFile } from "openai";
import { z } from "zod";
import GeneratedPostPreview from "@/components/generated-post-preview";
import { toast } from "sonner";

type Platform = "instagram" | "facebook" | "twitter";
type PostType = "post" | "story";

interface Template {
  width: number;
  height: number;
  label: string;
}

interface PlatformTemplates {
  [key: string]: {
    [key: string]: Template;
  };
}

interface GeneratedPost {
  caption: string;
  imageDescription: string;
  hashtags?: string[];
  platform: Platform;
  postType: PostType;
  timestamp: string;
  dimensions: Template;
  generatedImage?: string;
  referenceImages?: string[];
}

const platformTemplates: PlatformTemplates = {
  instagram: {
    post: { width: 1080, height: 1080, label: "Post (1:1)" },
    story: { width: 1080, height: 1920, label: "Story (9:16)" },
  },
  facebook: {
    post: { width: 1200, height: 630, label: "Post (1.91:1)" },
  },
  twitter: {
    post: { width: 1200, height: 675, label: "Post (16:9)" },
  },
};

const toneOptions = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "humorous", label: "Humorous" },
  { value: "inspirational", label: "Inspirational" },
  { value: "promotional", label: "Promotional" },
];

const client = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

const PostSchema = z.object({
  caption: z.string(),
  imageDescription: z.string(),
  hashtags: z.array(z.string()).optional(),
});

type PostSchema = z.infer<typeof PostSchema>;

export default function AIPostBuilder() {
  const [prompt, setPrompt] = useState("");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [postType, setPostType] = useState<PostType>("post");
  const [tone, setTone] = useState("casual");
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [hashtagCount, setHashtagCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] =
    useState<GeneratedPost | null>(null);
  const [generationError, setGenerationError] = useState("");
  const [postHistory, setPostHistory] = useState<GeneratedPost[]>([]);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);

  const handlePlatformChange = (value: Platform) => {
    setPlatform(value);
    const postTypes = Object.keys(platformTemplates[value]) as PostType[];
    setPostType(postTypes[0]);
  };

  const generateImage = async (imageDescription: string) => {
    if (!imageDescription.trim()) {
      return;
    }

    try {
      let response;

      if (referenceImages.length > 0) {
        const imageFiles = await Promise.all(
          referenceImages.map(async (img) => {
            const base64Data = img.split(",")[1];
            const buffer = Buffer.from(base64Data, "base64");
            return await toFile(buffer, "image.png", { type: "image/png" });
          })
        );

        response = await client.images.edit({
          model: "gpt-image-1",
          prompt: imageDescription,
          size: "1024x1024",
          quality: "high",
          n: 1,
          image: imageFiles,
        });
      } else {
        response = await client.images.generate({
          model: "gpt-image-1",
          prompt: imageDescription,
          size: "1024x1024",
          quality: "high",
          n: 1,
        });
      }

      if (response.data && response.data[0]?.b64_json) {
        const imageData = `data:image/png;base64,${response.data[0].b64_json}`;
        setGeneratedContent((prev) =>
          prev ? { ...prev, generatedImage: imageData } : null
        );
      }
    } catch {
      toast.error("Failed to generate image. Please try again.");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: string[] = [];
    const maxImages = 5;

    for (
      let i = 0;
      i < Math.min(files.length, maxImages - referenceImages.length);
      i++
    ) {
      const file = files[i];
      const reader = new FileReader();

      reader.onload = (event) => {
        if (event.target?.result) {
          newImages.push(event.target.result as string);
          if (
            newImages.length ===
            Math.min(files.length, maxImages - referenceImages.length)
          ) {
            setReferenceImages((prev) => [...prev, ...newImages]);
          }
        }
      };

      reader.readAsDataURL(file);
    }
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
  };

  const generatePost = async () => {
    if (!prompt.trim()) {
      setGenerationError("Please enter a description for your post");
      return;
    }

    setIsGenerating(true);
    setGenerationError("");

    try {
      const aiPrompt = `
        Create a social media post for ${platform} (${
        platformTemplates[platform][postType].label
      }) with a ${tone} tone.
        
        Post description: ${prompt}

        ${
          includeHashtags
            ? `Include ${hashtagCount} hashtags in the post. The hashtags should be relevant to the post and should not include the # symbol.`
            : "Do not include hashtags in the post."
        }

        DON'T INCLUDE HASHTAGS IN THE CAPTION.

        The image description should be in english.
      `;

      const completion = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a social media post generator.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: aiPrompt },
              ...referenceImages.map((img) => ({
                type: "image_url" as const,
                image_url: { url: img },
              })),
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "post",
            schema: {
              type: "object",
              properties: {
                caption: { type: "string" },
                imageDescription: { type: "string" },
                ...(includeHashtags && {
                  hashtags: {
                    type: "array",
                    description: "Hashtags for the post without the # symbol",
                    items: { type: "string" },
                  },
                }),
              },
              required: [
                "caption",
                "imageDescription",
                ...(includeHashtags ? ["hashtags"] : []),
              ],
              additionalProperties: false,
            },
            strict: true,
          },
        },
      });

      const text = completion.choices[0].message.content;

      if (!text) {
        throw new Error("No content received from OpenAI");
      }

      const parsedContent = PostSchema.parse(JSON.parse(text));

      const generatedPost: GeneratedPost = {
        ...parsedContent,
        platform,
        postType,
        timestamp: new Date().toISOString(),
        dimensions: platformTemplates[platform][postType],
        referenceImages:
          referenceImages.length > 0 ? referenceImages : undefined,
      };

      setGeneratedContent(generatedPost);
      setPostHistory([generatedPost, ...postHistory]);

      await generateImage(parsedContent.imageDescription);
    } catch {
      toast.error("Failed to generate post. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadPost = () => {
    if (!generatedContent?.generatedImage) {
      toast.error("No image generated");
      return;
    }

    const link = document.createElement("a");
    link.href = generatedContent.generatedImage;
    link.download = `post-${new Date().toISOString()}.png`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Post downloaded successfully");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="create" className="w-full">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prompt">Describe your post</Label>
                <Textarea
                  id="prompt"
                  placeholder="Describe what you want in your post. For example: 'A promotional post for our new summer collection featuring beach-themed products.'"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={5}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label>Reference Images (up to 5)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {referenceImages.map((img, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={img}
                        alt={`Reference ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => removeReferenceImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {referenceImages.length < 5 && (
                    <label className="flex items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <div className="flex flex-col items-center">
                        <Upload className="h-6 w-6 mb-1" />
                        <span className="text-sm">Upload Image</span>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="platform">Platform</Label>
                  <Select value={platform} onValueChange={handlePlatformChange}>
                    <SelectTrigger id="platform">
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instagram">
                        <div className="flex items-center">
                          <Instagram className="h-4 w-4 mr-2" />
                          Instagram
                        </div>
                      </SelectItem>
                      <SelectItem value="facebook">
                        <div className="flex items-center">
                          <Facebook className="h-4 w-4 mr-2" />
                          Facebook
                        </div>
                      </SelectItem>
                      <SelectItem value="twitter">
                        <div className="flex items-center">
                          <Twitter className="h-4 w-4 mr-2" />
                          Twitter
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postType">Format</Label>
                  <Select
                    value={postType}
                    onValueChange={(value: string) =>
                      setPostType(value as PostType)
                    }
                  >
                    <SelectTrigger id="postType">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(platformTemplates[platform]).map(
                        ([key, value]) => (
                          <SelectItem key={key} value={key}>
                            {(value as Template).label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tone">Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger id="tone">
                    <SelectValue placeholder="Select tone" />
                  </SelectTrigger>
                  <SelectContent>
                    {toneOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="hashtags"
                    checked={includeHashtags}
                    onCheckedChange={setIncludeHashtags}
                  />
                  <Label htmlFor="hashtags">Include hashtags</Label>
                </div>

                {includeHashtags && (
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="hashtagCount" className="text-sm">
                      Count: {hashtagCount}
                    </Label>
                    <Slider
                      id="hashtagCount"
                      min={1}
                      max={10}
                      step={1}
                      value={[hashtagCount]}
                      onValueChange={(value) => setHashtagCount(value[0])}
                      className="w-24"
                    />
                  </div>
                )}
              </div>

              {generationError && (
                <div className="text-sm text-red-500">{generationError}</div>
              )}

              <Button
                onClick={generatePost}
                disabled={isGenerating || !prompt.trim()}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Post
                  </>
                )}
              </Button>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="text-lg font-semibold mb-4">
            {generatedContent ? "Generated Post" : "Post Preview"}
          </div>

          {generatedContent ? (
            <>
              <GeneratedPostPreview content={generatedContent} />

              <div className="w-full flex justify-end">
                <Button onClick={downloadPost}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-[400px] rounded-md">
              <Sparkles className="h-12 w-12 mb-4" />
              <p className="text-center">
                Describe your post and click &quot;Generate Post&quot; to see
                the AI-generated content here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
