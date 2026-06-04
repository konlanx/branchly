import { intro, log, outro } from '@clack/prompts';

import type { ProvisionEvent, ProvisionOutcome } from '../kernel/provision';

export interface Reporter {
  readonly intro: (title: string) => void;
  readonly info: (message: string) => void;
  readonly step: (message: string) => void;
  readonly success: (message: string) => void;
  readonly error: (message: string) => void;
  readonly outro: (message: string) => void;
}

export interface ReporterOptions {
  readonly quiet: boolean;
}

export const createReporter = (options: ReporterOptions): Reporter => {
  const verbose = !options.quiet;
  return {
    intro: (title) => {
      if (verbose) {
        intro(title);
      }
    },
    info: (message) => {
      if (verbose) {
        log.info(message);
      }
    },
    step: (message) => {
      if (verbose) {
        log.step(message);
      }
    },
    success: (message) => {
      if (verbose) {
        log.success(message);
      }
    },
    error: (message) => {
      log.error(message);
    },
    outro: (message) => {
      if (verbose) {
        outro(message);
      }
    },
  };
};

const EVENT_MESSAGES: Record<ProvisionEvent['kind'], string> = {
  creating: 'Spinning up a fresh database 🐣',
  cloning: 'Cloning a snapshot ⚡',
  applying: 'Applying migrations 🧱',
  seeding: 'Planting seed data 🌱',
  snapshotting: 'Caching a snapshot for next time 📸',
};

export const narrateEvent = (reporter: Reporter, event: ProvisionEvent): void => {
  reporter.step(EVENT_MESSAGES[event.kind]);
};

export const narrateResult = (reporter: Reporter, ref: string, key: string, outcome: ProvisionOutcome): void => {
  if (outcome === 'fast-path') {
    reporter.outro(`"${ref}" is already in sync — nothing to do ✅`);
    return;
  }
  reporter.outro(`"${ref}" is ready to go on ${key}! 🎉`);
};
