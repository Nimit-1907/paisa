"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteInvestment } from "@/actions/investments";
import { InvestmentSheet } from "@/components/investments/investment-sheet";
import { Amount } from "@/components/shared/amount";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ListRow } from "@/components/shared/list-row";
import { ListCard } from "@/components/shared/surface";
import { Tile } from "@/components/shared/tile";
import {
  describeCadence,
  type Investment,
  type InvestmentGoal,
  KIND_META,
} from "@/lib/investments";

/**
 * A list of investments, each a row that opens its page, with Edit and
 * Delete by swipe, long-press and on the page itself. Holdings and a
 * goal's page both draw their lists with it.
 */
export function InvestmentList({
  investments,
  goals,
  today,
  showKind = true,
}: {
  investments: Investment[];
  goals: InvestmentGoal[];
  today: string;
  /** Off under a heading that already names the kind. */
  showKind?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<Investment | null>(null);
  const [deleting, setDeleting] = React.useState<Investment | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function confirmDelete() {
    const target = deleting;
    if (!target) return;
    setPending(true);
    try {
      const result = await deleteInvestment({ id: target.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${target.name} deleted.`);
      setDeleteOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <ListCard>
        {investments.map((investment) => (
          <li key={investment.id}>
            <InvestmentRow
              investment={investment}
              showKind={showKind}
              onEdit={() => setEditing(investment)}
              onDelete={() => {
                setDeleting(investment);
                setDeleteOpen(true);
              }}
            />
          </li>
        ))}
      </ListCard>

      <InvestmentSheet
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        investment={editing}
        goals={goals}
        today={today}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${deleting?.name ?? "this investment"}?`}
        description={`Its ${deleting?.entryCount ?? 0} ${
          deleting?.entryCount === 1 ? "entry goes" : "entries go"
        } with it. To keep the history, close it instead.`}
        pending={pending}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}

export function InvestmentRow({
  investment,
  showKind = true,
  onEdit,
  onDelete,
}: {
  investment: Investment;
  showKind?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = KIND_META[investment.kind];
  const schedule = investment.schedule;

  const detail = schedule
    ? `${describeCadence(schedule.cadence, schedule.startDate, schedule.anchorDay)}${
        schedule.paused ? ", paused" : ""
      }`
    : investment.maturityDate
      ? `Matures ${formatShortDay(investment.maturityDate)}`
      : showKind
        ? meta.long
        : null;

  const subtitle = [
    showKind && (schedule || investment.maturityDate) ? meta.label : null,
    detail,
    investment.platform,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <ListRow
      href={`/investments/${investment.id}`}
      leading={<Tile tint={meta.tint} icon={meta.icon} />}
      title={investment.name}
      subtitle={
        subtitle ? <span className="truncate">{subtitle}</span> : undefined
      }
      trailing={<Amount value={BigInt(investment.net)} />}
      trailingMeta={
        investment.status === "closed" ? (
          "Closed"
        ) : investment.redeemed > 0 ? (
          <>
            out <Amount value={BigInt(investment.redeemed)} compact />
          </>
        ) : (
          `${investment.entryCount} ${investment.entryCount === 1 ? "entry" : "entries"}`
        )
      }
      swipeRight={{ label: "Edit", icon: Pencil, onAction: onEdit }}
      swipeLeft={{
        label: "Delete",
        icon: Trash2,
        tone: "destructive",
        onAction: onDelete,
      }}
      menu={[
        { label: "Edit", icon: Pencil, onAction: onEdit },
        {
          label: "Delete",
          icon: Trash2,
          tone: "destructive",
          onAction: onDelete,
        },
      ]}
    />
  );
}

export function formatShortDay(day: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${day}T00:00:00Z`));
}
