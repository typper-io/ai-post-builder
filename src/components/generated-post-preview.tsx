/* eslint-disable @next/next/no-img-element */
"use client";

import Image from "next/image";
import { useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";

interface Dimensions {
  width: number;
  height: number;
}

interface Content {
  dimensions: Dimensions;
  caption: string;
  hashtags?: string[];
  imageDescription: string;
  generatedImage?: string;
  referenceImages?: string[];
}

export default function GeneratedPostPreview({
  content,
}: {
  content: Content;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    dimensions,
    caption,
    hashtags = [],
    imageDescription,
    generatedImage,
    referenceImages = [],
  } = content;

  const calculateScale = useCallback(() => {
    if (!containerRef.current) return 1;

    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

    const scaleX = containerWidth / dimensions.width;
    const scaleY = containerHeight / dimensions.height;

    return Math.min(scaleX, scaleY);
  }, [dimensions]);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const scale = calculateScale();
        const previewElement = containerRef.current.querySelector(
          ".preview-content"
        ) as HTMLElement;
        if (previewElement) {
          previewElement.style.transform = `scale(${scale})`;
        }
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [calculateScale, dimensions]);

  return (
    <div className="w-full flex items-center justify-center p-4">
      <div
        ref={containerRef}
        className="w-full max-w-[400px] rounded-2xl p-4 flex flex-col"
      >
        <div className="relative w-full pb-[100%]">
          {generatedImage ? (
            <Image
              src={generatedImage}
              alt={imageDescription}
              fill
              className="object-cover rounded-lg absolute inset-0"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
              <p className="text-center text-sm md:text-base opacity-70 px-4">
                {imageDescription ||
                  "Image would be generated based on your description"}
              </p>
            </div>
          )}
        </div>

        {referenceImages.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium mb-2">Reference Images:</h3>
            <div className="grid grid-cols-2 gap-2">
              {referenceImages.map((img, index) => (
                <img
                  key={index}
                  src={img}
                  alt={`Reference ${index + 1}`}
                  className="w-full h-24 object-cover rounded-lg"
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 space-y-2">
          <p
            className="text-base leading-snug cursor-pointer"
            onClick={() => {
              navigator.clipboard.writeText(caption);
              toast.success("Caption copied to clipboard");
            }}
          >
            {caption}
          </p>

          {hashtags && hashtags.length > 0 && (
            <p
              className="text-sm opacity-80 cursor-pointer"
              onClick={() => {
                navigator.clipboard.writeText(hashtags.join(" "));
                toast.success("Hashtags copied to clipboard");
              }}
            >
              {hashtags.map((tag: string) => `#${tag}`).join(" ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
