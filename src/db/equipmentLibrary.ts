/**
 * A small starter library of common AV / low-voltage rack gear with typical
 * rack-unit heights. Used by the rack editor to drop in items quickly; users
 * can still add fully custom equipment.
 */
export interface LibraryItem {
  label: string;
  heightU: number;
}

export const EQUIPMENT_LIBRARY: LibraryItem[] = [
  { label: 'Network Switch', heightU: 1 },
  { label: 'Patch Panel', heightU: 1 },
  { label: 'DSP / Audio Matrix', heightU: 2 },
  { label: 'Amplifier', heightU: 2 },
  { label: 'Video Matrix', heightU: 3 },
  { label: 'Power Conditioner', heightU: 1 },
  { label: 'UPS', heightU: 2 },
  { label: 'Rack Shelf', heightU: 1 },
  { label: 'Rack Drawer', heightU: 2 },
  { label: 'Blank Panel', heightU: 1 },
];
