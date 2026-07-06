import { useEffect, useState } from "react";
import { createSignedAssetUrl } from "../../vault/assets";

export default function SignedStorageImage({
  storagePath,
  fallbackSrc,
  alt,
  className,
  loadingClassName = "min-h-[12rem] animate-pulse rounded-xl border border-page-edge bg-parchment/70"
}: {
  storagePath?: string | null;
  fallbackSrc?: string | null;
  alt: string;
  className?: string;
  loadingClassName?: string;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!storagePath) {
      setSignedUrl(null);
      setFailed(false);
      return;
    }

    let active = true;
    setFailed(false);
    createSignedAssetUrl(storagePath)
      .then((url) => {
        if (active) setSignedUrl(url);
      })
      .catch(() => {
        if (active) {
          setSignedUrl(null);
          setFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, [storagePath]);

  const src = signedUrl || fallbackSrc || "";
  if (!src && storagePath && !failed) {
    return <div className={loadingClassName} aria-label={`Loading ${alt}`} />;
  }

  if (!src) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center rounded-xl border border-page-edge bg-parchment/70 text-sm text-ink-soft">
        Image unavailable
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} />;
}
