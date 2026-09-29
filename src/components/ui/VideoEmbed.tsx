import { resolveVideo } from "@/lib/embed";

// Player video responsive (YouTube/Vimeo via iframe, oppure file diretto).
export function VideoEmbed({ url }: { url: string }) {
  const v = resolveVideo(url);
  if (!v) return null;

  return (
    <div className="video-embed">
      {v.kind === "iframe" ? (
        <iframe
          src={v.src}
          title="Video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <video src={v.src} controls />
      )}
    </div>
  );
}
