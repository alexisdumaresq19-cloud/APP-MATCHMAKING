import { createRng, randomInt } from "./prng";

export type SeatingParticipant = { registrationId: string; sectorId: string | null };
export type SeatingTable = { id: string; seats: number };
export type SeatingMatch = { aId: string; bId: string; score: number; pinned?: boolean };
export type LockedAssignment = { registrationId: string; round: number; tableId: string };

export type SeatingInput = {
  participants: SeatingParticipant[];
  matches: SeatingMatch[];
  tables: SeatingTable[];
  rounds: number;
  locked?: LockedAssignment[];
  /** True when the rule set's penaltySameSector ≥ 100: never two same-sector people at a table. */
  forbidSameSector?: boolean;
  maxIterations?: number;
  timeBudgetMs?: number;
  seed?: number;
};

export type SeatingAssignment = {
  registrationId: string;
  round: number;
  tableId: string;
  isLocked: boolean;
};

export type RoundReport = {
  round: number;
  score: number;
  underfilledTables: { tableId: string; seated: number; seats: number }[];
  conflicts: { tableId: string; sectorId: string; count: number }[];
  repeatedPairs: number;
  unplaced: string[];
};

export type SeatingReport = {
  totalScore: number;
  rounds: RoundReport[];
  unplaced: { round: number; registrationId: string }[];
  relaxedSameSector: boolean;
};

const REPEAT_PENALTY = 50;
const CONFLICT_PENALTY = 1000;

/**
 * Seating (section 7.5): greedy construction per table, then local improvement by swaps,
 * repeated for every round with a penalty for pairs already seated together. Deterministic for a
 * given seed and iteration count (the time budget is only a safety cap).
 */
export function assignSeats(input: SeatingInput): {
  assignments: SeatingAssignment[];
  report: SeatingReport;
} {
  const n = input.participants.length;
  const tables = input.tables.map((t) => ({ ...t, seats: Math.max(0, Math.floor(t.seats)) }));
  const rounds = Math.max(1, input.rounds);
  const maxIterations = input.maxIterations ?? 2000;
  const totalBudgetMs = input.timeBudgetMs ?? 500;
  const timeBudgetMs = Math.max(20, totalBudgetMs / rounds);
  const rng = createRng(input.seed ?? 1);
  const forbidSameSector = input.forbidSameSector ?? false;

  const index = new Map<string, number>();
  input.participants.forEach((p, i) => index.set(p.registrationId, i));
  const sector = input.participants.map((p) => p.sectorId);

  // Base score matrix (pinned matches count double).
  const base = new Float64Array(n * n);
  for (const match of input.matches) {
    const i = index.get(match.aId);
    const j = index.get(match.bId);
    if (i === undefined || j === undefined || i === j) continue;
    const value = match.score * (match.pinned ? 2 : 1);
    base[i * n + j] = value;
    base[j * n + i] = value;
  }
  const metBefore = new Uint8Array(n * n);
  const assignments: SeatingAssignment[] = [];
  const report: SeatingReport = {
    totalScore: 0,
    rounds: [],
    unplaced: [],
    relaxedSameSector: false,
  };

  for (let round = 1; round <= rounds; round += 1) {
    const eff = (i: number, j: number): number => {
      let value = base[i * n + j];
      if (metBefore[i * n + j]) value -= REPEAT_PENALTY;
      if (forbidSameSector && sector[i] && sector[i] === sector[j]) value -= CONFLICT_PENALTY;
      return value;
    };

    const tableOf = new Int32Array(n).fill(-1);
    const members: number[][] = tables.map(() => []);
    const locked = new Uint8Array(n);

    for (const lock of input.locked ?? []) {
      if (lock.round !== round) continue;
      const i = index.get(lock.registrationId);
      const t = tables.findIndex((table) => table.id === lock.tableId);
      if (i === undefined || t === -1 || members[t].length >= tables[t].seats) continue;
      tableOf[i] = t;
      members[t].push(i);
      locked[i] = 1;
    }

    const contribution = (i: number, table: number, excluding = -1): number => {
      let total = 0;
      for (const other of members[table])
        if (other !== i && other !== excluding) total += eff(i, other);
      return total;
    };
    const hasConflict = (i: number, table: number): boolean =>
      forbidSameSector &&
      !!sector[i] &&
      members[table].some((other) => sector[other] === sector[i]);

    // --- Greedy construction ---
    const unplaced = new Set<number>();
    for (let i = 0; i < n; i += 1) if (tableOf[i] === -1) unplaced.add(i);
    const remainingTotal = (i: number): number => {
      let total = 0;
      for (const other of unplaced) if (other !== i) total += eff(i, other);
      return total;
    };
    // Even distribution: aim for ceil(n / tables) per table before topping tables up.
    const target = tables.length ? Math.ceil(n / tables.length) : 0;

    const pickBest = (table: number, requireNoConflict: boolean): number | null => {
      let best: number | null = null;
      let bestValue = -Infinity;
      let bestTotal = -Infinity;
      for (const i of unplaced) {
        if (requireNoConflict && hasConflict(i, table)) continue;
        const value = members[table].length ? contribution(i, table) : 0;
        const total = remainingTotal(i);
        if (
          value > bestValue ||
          (value === bestValue &&
            (total > bestTotal || (total === bestTotal && (best === null || i < best))))
        ) {
          best = i;
          bestValue = value;
          bestTotal = total;
        }
      }
      return best;
    };
    const place = (i: number, table: number) => {
      tableOf[i] = table;
      members[table].push(i);
      unplaced.delete(i);
    };

    const addBest = (table: number): boolean => {
      let pick = pickBest(table, true);
      if (pick === null) {
        pick = pickBest(table, false);
        if (pick === null) return false;
        report.relaxedSameSector = true;
      }
      place(pick, table);
      return true;
    };
    // Seed each empty table with the strongest remaining hub, so hubs are spread across tables…
    for (let table = 0; table < tables.length && unplaced.size; table += 1) {
      if (members[table].length === 0 && tables[table].seats > 0) addBest(table);
    }
    // …then fill tables round-robin up to an even target, then top up whatever room is left.
    let progress = true;
    while (unplaced.size && progress) {
      progress = false;
      for (let table = 0; table < tables.length && unplaced.size; table += 1) {
        if (members[table].length >= Math.min(Math.max(1, target), tables[table].seats)) continue;
        if (addBest(table)) progress = true;
      }
    }
    progress = true;
    while (unplaced.size && progress) {
      progress = false;
      for (let table = 0; table < tables.length && unplaced.size; table += 1) {
        if (members[table].length >= tables[table].seats) continue;
        if (addBest(table)) progress = true;
      }
    }

    // --- Local improvement (iterated local search) ---
    // 1. First-improvement passes: for each movable participant, apply the best gain among moving to
    //    a free seat or swapping with someone at another table, until a pass brings no gain.
    // 2. Perturb (a few random swaps), re-optimize, keep the result only if the total improves.
    // Stops after `maxIterations` applied moves or when the time budget is spent. Deterministic for a
    // given seed and iteration count (the time budget is only a safety cap).
    const movable: number[] = [];
    for (let i = 0; i < n; i += 1) if (tableOf[i] !== -1 && !locked[i]) movable.push(i);
    for (let k = movable.length - 1; k > 0; k -= 1) {
      const swapWith = randomInt(rng, k + 1);
      [movable[k], movable[swapWith]] = [movable[swapWith], movable[k]];
    }
    const started = Date.now();
    let applied = 0;
    const budgetLeft = () => applied < maxIterations && Date.now() - started < timeBudgetMs;

    const moveTo = (i: number, from: number, to: number) => {
      members[from] = members[from].filter((x) => x !== i);
      members[to].push(i);
      tableOf[i] = to;
    };
    const swap = (i: number, j: number) => {
      const a = tableOf[i];
      const b = tableOf[j];
      members[a] = members[a].map((x) => (x === i ? j : x));
      members[b] = members[b].map((x) => (x === j ? i : x));
      tableOf[i] = b;
      tableOf[j] = a;
    };
    const objective = (): number => {
      let total = 0;
      for (const list of members) {
        for (let x = 0; x < list.length; x += 1) {
          for (let y = x + 1; y < list.length; y += 1) total += eff(list[x], list[y]);
        }
      }
      return total;
    };
    const improve = () => {
      let improved = true;
      while (improved && budgetLeft()) {
        improved = false;
        for (const i of movable) {
          if (!budgetLeft()) break;
          const a = tableOf[i];
          const current = contribution(i, a);
          let bestGain = 1e-9;
          let bestTable = -1;
          let bestPartner = -1;
          for (let b = 0; b < tables.length; b += 1) {
            if (b === a) continue;
            if (members[b].length < tables[b].seats) {
              const gain = contribution(i, b) - current;
              if (gain > bestGain) {
                bestGain = gain;
                bestTable = b;
                bestPartner = -1;
              }
            }
            for (const j of members[b]) {
              if (locked[j]) continue;
              const gain =
                contribution(i, b, j) + contribution(j, a, i) - current - contribution(j, b);
              if (gain > bestGain) {
                bestGain = gain;
                bestTable = b;
                bestPartner = j;
              }
            }
          }
          if (bestTable === -1) continue;
          if (bestPartner === -1) moveTo(i, a, bestTable);
          else swap(i, bestPartner);
          applied += 1;
          improved = true;
        }
      }
    };

    const debug = process.env.DEBUG_SEATING === "1";
    if (debug) console.log(`round ${round} greedy objective`, objective());
    improve();
    if (debug) console.log(`round ${round} after improve`, objective(), "applied", applied);
    if (movable.length > 3 && tables.length > 1) {
      let bestValue = objective();
      let bestTableOf = Int32Array.from(tableOf);
      let bestMembers = members.map((list) => [...list]);
      const kicks = Math.max(2, Math.floor(movable.length / 8));
      while (budgetLeft()) {
        for (let k = 0; k < kicks; k += 1) {
          const i = movable[randomInt(rng, movable.length)];
          const j = movable[randomInt(rng, movable.length)];
          if (tableOf[i] !== tableOf[j]) swap(i, j);
        }
        applied += kicks;
        improve();
        const value = objective();
        if (value >= bestValue) {
          bestValue = value;
          bestTableOf = Int32Array.from(tableOf);
          bestMembers = members.map((list) => [...list]);
        } else {
          tableOf.set(bestTableOf);
          for (let t = 0; t < members.length; t += 1) members[t] = [...bestMembers[t]];
        }
      }
      if (debug) console.log(`round ${round} after ILS`, bestValue, "applied", applied);
    }

    // --- Report for this round ---
    let roundScore = 0;
    let repeatedPairs = 0;
    const conflicts: RoundReport["conflicts"] = [];
    const underfilledTables: RoundReport["underfilledTables"] = [];
    tables.forEach((table, t) => {
      const list = members[t];
      for (let x = 0; x < list.length; x += 1) {
        for (let y = x + 1; y < list.length; y += 1) {
          roundScore += base[list[x] * n + list[y]];
          if (metBefore[list[x] * n + list[y]]) repeatedPairs += 1;
          metBefore[list[x] * n + list[y]] = 1;
          metBefore[list[y] * n + list[x]] = 1;
        }
      }
      if (forbidSameSector) {
        const counts = new Map<string, number>();
        for (const i of list)
          if (sector[i]) counts.set(sector[i]!, (counts.get(sector[i]!) ?? 0) + 1);
        for (const [sectorId, count] of counts)
          if (count > 1) conflicts.push({ tableId: table.id, sectorId, count });
      }
      if (list.length < Math.ceil(table.seats / 2) && n >= tables.length) {
        underfilledTables.push({ tableId: table.id, seated: list.length, seats: table.seats });
      }
      for (const i of list) {
        assignments.push({
          registrationId: input.participants[i].registrationId,
          round,
          tableId: table.id,
          isLocked: locked[i] === 1,
        });
      }
    });
    const unplacedIds = [...unplaced].map((i) => input.participants[i].registrationId);
    for (const registrationId of unplacedIds) report.unplaced.push({ round, registrationId });
    report.rounds.push({
      round,
      score: roundScore,
      underfilledTables,
      conflicts,
      repeatedPairs,
      unplaced: unplacedIds,
    });
    report.totalScore += roundScore;
  }

  return { assignments, report };
}
