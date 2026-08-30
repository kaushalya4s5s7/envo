'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { CaptureJob } from '@/lib/capture-store';
import { agentModel, agentSummary } from '@/lib/brief';
import { Reveal } from './reveal';
import { MorningBrief } from './morning-brief';
import { DigestForm } from './digest-form';

/**
 * The 07:15 screen, for one building.
 *
 * With `?capture=<id>` this is the user's own building, captured live minutes
 * ago. Without one it is the committed demo day, and says so — a screen that
 * showed Manhattan's day to someone who typed a Chicago address would be the
 * single most dishonest thing in the product.
 */
export function Today() {
  const id = useSearchParams().get('capture');
  const [job, setJob] = useState<CaptureJob | null>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!id) return;
    let live = true;
    fetch(`/api/capture?id=${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('expired'))))
      .then((j: CaptureJob) => { if (live) setJob(j); })
      .catch(() => { if (live) setGone(true); });
    return () => { live = false; };
  }, [id]);

  const artifact = job?.artifact;
  const timezone = job?.preview?.timezone;

  return (
    <>
      <Reveal delay={120}>
        <h1 className="heading-gradient max-w-[680px] text-center text-4xl text-balance md:text-6xl md:leading-none">
          Two minutes.<br />Then get on with it.
        </h1>
      </Reveal>
      <Reveal delay={230}>
        <p className="mt-6 max-w-[680px] text-center text-base text-pretty text-fg-2 md:text-lg">
          {artifact
            ? <>Captured for {artifact.building.name} a few minutes ago. This is the one screen that
              tells you what today will do to it, at what hour, and what to do about it.</>
            : <>This is the one screen that tells you which of your buildings will be a problem today,
              at what hour, and what to do about it.</>}
        </p>
      </Reveal>

      {id && !artifact && !gone ? (
        <p className="mt-8 font-mono text-xs text-fg-3">LOADING YOUR CAPTURE…</p>
      ) : null}

      {gone ? (
        <p className="mt-8 max-w-[560px] text-center text-sm text-pretty text-fg-3">
          That capture has expired — captures are held in memory for thirty minutes and nothing is
          stored. <Link href="/onboarding" className="text-fg-2 underline underline-offset-4">Run a new one</Link>.
        </p>
      ) : null}

      {!id ? (
        <p className="mt-8 max-w-[560px] text-center text-sm text-pretty text-fg-3">
          You are looking at the committed demo day, not a building of yours.{' '}
          <Link href="/onboarding" className="text-fg-2 underline underline-offset-4">
            Type your own address
          </Link>{' '} to capture the real one.
        </p>
      ) : null}

      <Reveal delay={340} className="mt-10 flex w-full justify-center">
        <MorningBrief
          {...(artifact ? { day: artifact } : {})}
          {...(timezone ? { timezone } : {})}
          {...(artifact ? {} : { agent: { model: agentModel, summary: agentSummary } })}
        />
      </Reveal>

      {job?.assumptions?.length ? (
        <div className="mt-6 w-full max-w-[1120px] rounded-2xl border border-line bg-surface p-2">
          <div className="rounded-lg border border-line bg-ink p-4">
            <div className="font-mono text-xs tracking-wider text-fg-3">WHAT WE ASSUMED ABOUT YOUR BUILDING</div>
            <ul className="mt-2 space-y-1">
              {job.assumptions.map((a) => (
                <li key={a} className="text-sm text-pretty text-fg-3">— {a}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {id && artifact ? <DigestForm buildingId={id} /> : null}
    </>
  );
}
