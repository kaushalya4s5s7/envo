const V1_URL = 'https://envy-main-v1.up.railway.app';

export function VersionStrip() {
  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-[var(--notice-h)] border-b border-white/[0.07] bg-[#0B0907]">
      <p className="mx-auto flex h-full max-w-[1344px] items-center justify-center gap-x-2.5 px-5 text-[12px] leading-none text-[#8A8580]">
        <span className="hidden sm:inline">
          UI v1 from the demo video is on the previous deployment.
        </span>
        <span className="sm:hidden">UI v1 from the demo video</span>
        <a
          href={V1_URL}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-[#DDD8D5] underline decoration-white/25 underline-offset-4 transition-colors duration-300 ease-out hover:text-white"
        >
          Open it
        </a>
      </p>
    </div>
  );
}
