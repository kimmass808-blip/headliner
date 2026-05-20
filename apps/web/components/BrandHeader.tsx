import Link from 'next/link';

export function BrandHeader() {
  return (
    <header className="bg-neutral-950">
      <div className="container mx-auto flex max-w-5xl items-center px-6 py-6">
        <Link href="/" className="inline-block" aria-label="Headliner 홈">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/headliner.png"
            alt="Headliner"
            className="h-7 w-auto"
          />
        </Link>
      </div>
    </header>
  );
}
