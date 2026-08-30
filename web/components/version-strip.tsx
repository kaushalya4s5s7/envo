const V1_URL = 'https://envy-main-v1.up.railway.app';
const DEMO_VIDEO_URL = 'https://youtu.be/-8r6QPC62YI';

function DemoVideoLink() {
  return (
    <a
      href={DEMO_VIDEO_URL}
      target="_blank"
      rel="noreferrer"
      className="text-[#DDD8D5] underline decoration-white/25 underline-offset-4 transition-colors duration-300 ease-out hover:text-white"
    >
      demo video
    </a>
  );
}

export function VersionStrip() {
  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-[var(--notice-h)] border-b border-white/[0.07] bg-[#0B0907]">
      <p className="mx-auto flex h-full max-w-[1344px] items-center justify-center gap-x-2.5 px-5 text-[12px] leading-none text-[#8A8580]">
        <span className="hidden sm:inline">
          UI v1 from the <DemoVideoLink /> is on the previous deployment.
        </span>
        <span className="sm:hidden">
          UI v1 from the <DemoVideoLink />
        </span>
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
