import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import {
  addEquipment,
  createProject,
  createRack,
  deleteRack,
  listEquipment,
  listRacks,
  updateEquipment,
} from './repository';

beforeEach(async () => {
  await Promise.all([
    db.projects.clear(),
    db.racks.clear(),
    db.equipment.clear(),
  ]);
});

describe('rack + equipment repository', () => {
  it('creates racks clamped to a sane RU height', async () => {
    const project = await createProject('Site');
    const rack = await createRack(project.id, 'Rack 1', 999);
    expect(rack.ruHeight).toBe(60); // clamped
    const racks = await listRacks(project.id);
    expect(racks).toHaveLength(1);
  });

  it('adds, updates, and lists equipment by start U', async () => {
    const project = await createProject('Site');
    const rack = await createRack(project.id, 'Rack 1', 42);
    await addEquipment(rack.id, { label: 'Amp', startU: 1, heightU: 2 });
    await addEquipment(rack.id, { label: 'Switch', startU: 40, heightU: 1 });

    let items = await listEquipment(rack.id);
    expect(items.map((i) => i.label)).toEqual(['Amp', 'Switch']); // sorted by startU

    await updateEquipment(items[0].id, { startU: 41, heightU: 1 });
    items = await listEquipment(rack.id);
    expect(items.map((i) => i.label)).toEqual(['Switch', 'Amp']);
  });

  it('deletes a rack and its equipment', async () => {
    const project = await createProject('Site');
    const rack = await createRack(project.id, 'Rack 1', 42);
    await addEquipment(rack.id, { label: 'Amp', startU: 1, heightU: 2 });

    await deleteRack(rack.id);

    expect(await listRacks(project.id)).toHaveLength(0);
    expect(await listEquipment(rack.id)).toHaveLength(0);
  });
});
