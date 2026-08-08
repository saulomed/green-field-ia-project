import Image from "next/image";

/**
 * StreamTube wordmark: red play-mark icon + "StreamTube".
 * Mirrors the Figma `BrandLogo` component (Size=lg).
 */
export function BrandLogo() {
  return (
    <div className="flex items-center gap-2">
      <Image
        src="/streamtube-mark.svg"
        alt=""
        width={40}
        height={40}
        className="size-10"
        priority
      />
      <span className="text-heading-h1 text-foreground">StreamTube</span>
    </div>
  );
}
