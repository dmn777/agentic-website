// The gallery, in hanging order.
import type { Piece } from './types';
import { combed } from './pieces/combed';
import { packing } from './pieces/packing';
import { survey } from './pieces/survey';
import { sunflower } from './pieces/sunflower';
import { partitions } from './pieces/partitions';
import { stipple } from './pieces/stipple';
import { truchet } from './pieces/truchet';
import { drift } from './pieces/drift';

export const PIECES: Piece[] = [combed, packing, survey, sunflower, partitions, stipple, truchet, drift];
export const pieceById = (id: string) => PIECES.find((p) => p.id === id);
