import Link from 'next/link';

type Artist = {
  id: string;
  canonicalName: string;
  aliases: string[];
  igHandle: string | null;
};

export function ArtistResultCard({ artist }: { artist: Artist }) {
  return (
    <div className="border-b border-neutral-200 py-6">
      <p className="text-[11px] uppercase tracking-wider text-accent">Artist</p>
      <Link href={`/artists/${artist.id}`} className="group">
        <h3 className="mt-1 text-2xl font-semibold text-neutral-900 group-hover:text-accent">
          {artist.canonicalName}
        </h3>
      </Link>
      {artist.aliases.length > 0 ? (
        <p className="mt-1 text-sm text-neutral-500">
          {artist.aliases.join(' · ')}
        </p>
      ) : null}
      {artist.igHandle ? (
        <a
          href={`https://www.instagram.com/${artist.igHandle}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-neutral-400 hover:text-accent"
        >
          @{artist.igHandle}
        </a>
      ) : null}
    </div>
  );
}
