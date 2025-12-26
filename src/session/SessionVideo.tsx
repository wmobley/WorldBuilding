import { useEffect, useRef } from "react";

export default function SessionVideo({
  stream,
  muted,
  placeholder
}: {
  stream: MediaStream | null;
  muted: boolean;
  placeholder: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    if (stream) {
      node.srcObject = stream;
      node.play().catch(() => undefined);
    } else {
      node.srcObject = null;
    }
  }, [stream]);

  if (!stream) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-ink-soft">
        {placeholder}
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      className="h-full w-full object-cover"
      autoPlay
      playsInline
      muted={muted}
    />
  );
}
