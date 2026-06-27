import type { SignalType } from '../db/models';

/** Consistent colors for signal types across the drawing and the list. */
export const SIGNAL_COLORS: Record<SignalType, string> = {
  audio: '#16a34a', // green
  video: '#2563eb', // blue
  network: '#9333ea', // purple
  control: '#ea580c', // orange
  power: '#dc2626', // red
  other: '#64748b', // slate
};

export const SIGNAL_TYPES: SignalType[] = [
  'video',
  'audio',
  'network',
  'control',
  'power',
  'other',
];
