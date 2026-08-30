const V1_URL = 'https://envy-main-v1.up.railway.app';

export function VersionStrip() {
  return (
    <div className="fixed inset-x-0 top-0 z-[60] border-b border-[#393432] bg-[#0B0907]">
      <p className="mx-auto flex max-w-[1344px] flex-wrap items-center justify-center gap-x-3 gap-y-1 px-5 py-2 text-center font-mono text-xs tracking-[0.04em] text-[#B1ACA6]">
        <span>UI v1, the cut in the demo video, is on the previous deployment.</span>
        <a
          href={V1_URL}
          target="_blank"
          rel="noreferrer"
          className="text-[#FF8B3E] underline decoration-[#FF8B3E]/40 underline-offset-4 transition-colors duration-300 ease-out hover:text-[#DDD8D5]"
        >
          Open that site
        </a>
      </p>
    </div>
  );
}
