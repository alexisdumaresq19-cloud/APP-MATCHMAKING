"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangleIcon, LockIcon, LockOpenIcon, UserRoundXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "@/components/ui/animated-icon";
import { moveSeat, toggleSeatLock } from "@/server/actions/tables";
import type { RoundPlan, SeatMember, TablePlan } from "@/server/queries/tables";
import { cn } from "@/lib/utils";

const UNPLACED = "unplaced";

type Props = {
  eventId: string;
  round: RoundPlan;
  forbidSameSector: boolean;
};

/**
 * One round of the seating plan: a column per table, a column for the unseated people. Drag a
 * person to another table (or use the keyboard: space, arrows, space); a manual move locks the seat.
 */
export function SeatingBoard({ eventId, round: initialRound, forbidSameSector }: Props) {
  const [round, setRound] = useState(initialRound);
  const [active, setActive] = useState<SeatMember | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => setRound(initialRound), [initialRound]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const memberIndex = useMemo(() => {
    const map = new Map<string, { member: SeatMember; tableId: string | null }>();
    for (const table of round.tables)
      for (const member of table.members)
        map.set(member.registrationId, { member, tableId: table.id });
    for (const member of round.unplaced) map.set(member.registrationId, { member, tableId: null });
    return map;
  }, [round]);

  function applyMove(registrationId: string, toTableId: string | null, lock: boolean) {
    setRound((current) => {
      const entry = memberIndex.get(registrationId);
      if (!entry) return current;
      const moved: SeatMember = { ...entry.member, isLocked: lock };
      const tables = current.tables.map((table) => ({
        ...table,
        members: table.members.filter((m) => m.registrationId !== registrationId),
      }));
      const unplaced = current.unplaced.filter((m) => m.registrationId !== registrationId);
      if (toTableId) {
        const target = tables.find((t) => t.id === toTableId);
        if (target) target.members = [...target.members, moved];
      } else {
        unplaced.push(moved);
      }
      return { ...current, tables, unplaced };
    });
  }

  function onDragStart(event: DragStartEvent) {
    setActive(memberIndex.get(String(event.active.id))?.member ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    setActive(null);
    const registrationId = String(event.active.id);
    const over = event.over ? String(event.over.id) : null;
    if (!over) return;
    const from = memberIndex.get(registrationId)?.tableId ?? null;
    const to = over === UNPLACED ? null : over;
    if (from === to) return;
    if (to) {
      const table = round.tables.find((t) => t.id === to);
      if (table && table.members.length >= table.seats) {
        toast.error(`${table.name} est pleine.`);
        return;
      }
    }
    applyMove(registrationId, to, Boolean(to));
    startTransition(async () => {
      const result = await moveSeat(eventId, { registrationId, round: round.round, tableId: to });
      if (result && !result.ok) {
        toast.error(result.formError ?? "Le déplacement a échoué.");
        applyMove(registrationId, from, false);
      }
    });
  }

  function onToggleLock(member: SeatMember) {
    const next = !member.isLocked;
    setRound((current) => ({
      ...current,
      tables: current.tables.map((table) => ({
        ...table,
        members: table.members.map((m) =>
          m.registrationId === member.registrationId ? { ...m, isLocked: next } : m,
        ),
      })),
    }));
    startTransition(async () => {
      const result = await toggleSeatLock(eventId, member.registrationId, round.round, next);
      if (result && !result.ok) toast.error(result.formError ?? "Une erreur est survenue.");
    });
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div
        className={cn(
          "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
          pending && "opacity-90",
        )}
        aria-busy={pending || undefined}
      >
        {round.tables.map((table) => (
          <TableColumn
            key={table.id}
            table={table}
            forbidSameSector={forbidSameSector}
            onToggleLock={onToggleLock}
          />
        ))}
        <UnplacedColumn members={round.unplaced} />
      </div>
      <DragOverlay dropAnimation={null}>
        {active ? <PersonCard member={active} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function TableColumn({
  table,
  forbidSameSector,
  onToggleLock,
}: {
  table: TablePlan;
  forbidSameSector: boolean;
  onToggleLock: (member: SeatMember) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: table.id });
  const free = table.seats - table.members.length;
  const full = free <= 0;
  const conflicts = table.conflicts;
  return (
    <section
      ref={setNodeRef}
      aria-label={table.name}
      className={cn(
        "flex min-h-40 flex-col rounded-lg border bg-card transition-colors",
        isOver && !full && "border-brand bg-brand/5",
        isOver && full && "border-destructive/60",
        conflicts.length && forbidSameSector && "border-amber-400",
      )}
    >
      <header className="flex items-start justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{table.name}</h3>
          <p className="text-xs text-muted-foreground">
            {table.members.length}/{table.seats} place{table.seats > 1 ? "s" : ""}
            {free > 0 ? ` · ${free} libre${free > 1 ? "s" : ""}` : " · complète"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {table.averageScore !== null ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                table.averageScore >= 70
                  ? "bg-green-100 text-green-900"
                  : table.averageScore >= 50
                    ? "bg-amber-100 text-amber-900"
                    : "bg-muted text-muted-foreground",
              )}
              title="Score moyen des jumelages à cette table"
            >
              {table.averageScore}
            </span>
          ) : null}
          {conflicts.length && forbidSameSector ? (
            <span
              className="inline-flex items-center gap-1 text-xs text-amber-700"
              title={`Même secteur : ${conflicts.join(", ")}`}
            >
              <AlertTriangleIcon className="size-3.5" aria-hidden="true" />
              {conflicts.length > 1 ? `${conflicts.length} conflits` : "conflit"}
            </span>
          ) : conflicts.length ? (
            <span
              className="text-xs text-muted-foreground"
              title={`Même secteur : ${conflicts.join(", ")}`}
            >
              {conflicts.length > 1
                ? `${conflicts.length} secteurs en double`
                : "1 secteur en double"}
            </span>
          ) : null}
        </div>
      </header>
      <ul className="flex flex-1 flex-col gap-1.5 p-2">
        {table.members.map((member) => (
          <li key={member.registrationId}>
            <DraggablePerson
              member={member}
              conflict={
                forbidSameSector && Boolean(member.sector && conflicts.includes(member.sector))
              }
              onToggleLock={onToggleLock}
            />
          </li>
        ))}
        {free > 0 ? (
          <li className="rounded-md border border-dashed px-2 py-1.5 text-center text-xs text-muted-foreground">
            {free} place{free > 1 ? "s" : ""} libre{free > 1 ? "s" : ""}
          </li>
        ) : null}
      </ul>
    </section>
  );
}

function UnplacedColumn({ members }: { members: SeatMember[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: UNPLACED });
  return (
    <section
      ref={setNodeRef}
      aria-label="Non placés"
      className={cn(
        "flex min-h-40 flex-col rounded-lg border border-dashed bg-muted/30 transition-colors",
        isOver && "border-brand bg-brand/5",
      )}
    >
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <UserRoundXIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-base font-semibold">Non placés</h3>
        <span className="ml-auto text-xs text-muted-foreground">{members.length}</span>
      </header>
      <ul className="flex flex-1 flex-col gap-1.5 p-2">
        {members.map((member) => (
          <li key={member.registrationId}>
            <DraggablePerson member={member} conflict={false} />
          </li>
        ))}
        {members.length === 0 ? (
          <li className="flex flex-1 flex-col items-center justify-center gap-1 py-4 text-center text-xs text-muted-foreground">
            <AnimatedIcon name="circle-check" size={20} play />
            Tout le monde a une place
          </li>
        ) : null}
      </ul>
    </section>
  );
}

function DraggablePerson({
  member,
  conflict,
  onToggleLock,
}: {
  member: SeatMember;
  conflict: boolean;
  onToggleLock?: (member: SeatMember) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: member.registrationId,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn("touch-none", isDragging && "opacity-40")}
    >
      <PersonCard
        member={member}
        conflict={conflict}
        handleProps={{ ...attributes, ...listeners }}
        onToggleLock={onToggleLock}
      />
    </div>
  );
}

function PersonCard({
  member,
  conflict,
  overlay,
  handleProps,
  onToggleLock,
}: {
  member: SeatMember;
  conflict?: boolean;
  overlay?: boolean;
  handleProps?: Record<string, unknown>;
  onToggleLock?: (member: SeatMember) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-sm",
        overlay && "shadow-lg ring-2 ring-brand",
        conflict && "border-amber-400",
        member.status === "CHECKED_IN" && "border-l-4 border-l-green-500",
      )}
    >
      <button
        type="button"
        className="min-w-0 flex-1 cursor-grab rounded text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing"
        aria-label={`Déplacer ${member.name}`}
        {...handleProps}
      >
        <span className="block truncate font-medium">{member.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {member.company}
          {member.sector ? ` · ${member.sector}` : ""}
        </span>
      </button>
      {onToggleLock ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn("shrink-0", member.isLocked ? "text-brand" : "text-muted-foreground")}
          aria-label={
            member.isLocked ? `Déverrouiller ${member.name}` : `Verrouiller ${member.name}`
          }
          aria-pressed={member.isLocked}
          onClick={() => onToggleLock(member)}
        >
          {member.isLocked ? <LockIcon aria-hidden="true" /> : <LockOpenIcon aria-hidden="true" />}
        </Button>
      ) : null}
    </div>
  );
}
