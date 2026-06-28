import { describe, expect, it } from 'vitest';
import { connectionsToCsv, csvToConnections, parseCsv } from './csv';
import type { Connection } from '../db/models';

describe('csv', () => {
  it('parses quoted fields with commas and quotes', () => {
    const rows = parseCsv('a,"b,c","d""e"\n1,2,3');
    expect(rows).toEqual([
      ['a', 'b,c', 'd"e'],
      ['1', '2', '3'],
    ]);
  });

  it('round-trips connections through CSV', () => {
    const conns: Connection[] = [
      {
        id: '1',
        projectId: 'p',
        fromPointId: 'pt1',
        fromPort: 'OUT 1',
        toLabel: 'Display A',
        toPort: 'HDMI 1',
        signalType: 'video',
        cableLabel: 'V-101',
      },
    ];
    const csv = connectionsToCsv(conns, (id) =>
      id === 'pt1' ? 'DSP' : undefined,
    );
    expect(csv.split('\r\n')[0]).toContain('From Device');

    const parsed = csvToConnections(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      fromLabel: 'DSP',
      fromPort: 'OUT 1',
      toLabel: 'Display A',
      toPort: 'HDMI 1',
      signalType: 'video',
      cableLabel: 'V-101',
    });
  });

  it('defaults unknown signal types to "other"', () => {
    const parsed = csvToConnections(
      'From Device,From Port,To Device,To Port,Signal Type,Cable Label\nX,,Y,,bogus,',
    );
    expect(parsed[0].signalType).toBe('other');
  });
});
