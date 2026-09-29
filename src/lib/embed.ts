// Converte un URL video (YouTube/Vimeo) nel relativo URL di embed.
// Restituisce { kind: "iframe", src } per i player, oppure
// { kind: "video", src } per file video diretti (mp4/webm), o null.

export function resolveVideo(
  url: string
): { kind: "iframe" | "video"; src: string } | null {
  if (!url) return null;

  // YouTube
  const yt =
    url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  if (yt) return { kind: "iframe", src: `https://www.youtube.com/embed/${yt[1]}` };

  // Vimeo
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { kind: "iframe", src: `https://player.vimeo.com/video/${vm[1]}` };

  // File video diretto
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) return { kind: "video", src: url };

  // Fallback: prova a embeddare l'URL così com'è.
  return { kind: "iframe", src: url };
}
