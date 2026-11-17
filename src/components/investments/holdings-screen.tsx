"use client";

import * as React from "react";

import { Layers } from "lucide-react";

import { InvestmentList } from "@/components/investments/investment-list";
import { NewInvestmentButton } from "@/components/investments/new-investment-button";
import { Amount } from "@/components/shared/amount";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { SegmentedControl } from "@/components/shared/segmented-control";
import {
  INVESTMENT_KINDS,
  type Investment,
  type InvestmentGoal,
  KIND_META,
} from "@/lib/investments";

/**
 * Every investment, grouped by kind with what each kind holds, so "how much
 * is in FDs" is read off a heading rather than added up in your head.
 */
export function HoldingsScreen({
  investments,
  goals,
  today,
}: {
  investments: Investment[];
  goals: InvestmentGoal[];
  today: string;
}) {
  const [tab, setTab] = React.useState<"open" | "closed">("open");
  const closedCount = investments.filter((i) => i.status === "closed").length;
  const shown = investments.filter((i) => i.status === tab);

  if (investments.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="Nothing held yet"
        description="Your SIPs, deposits, stocks and the rest will be listed here by kind."
        action={<NewInvestmentButton goals={goals} today={today} />}
      />
    );
  }

  const groups = INVESTMENT_KINDS.map((kind) => {
    const rows = shown.filter((investment) => investment.kind === kind);
    return {
      kind,
      rows,
      net: rows.reduce((sum, investment) => sum + investment.net, 0),
    };
  }).filter((group) => group.rows.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <NewInvestmentButton goals={goals} today={today} />
      </div>

      {closedCount > 0 ? (
        <SegmentedControl
          label="Open or closed"
          value={tab}
          onChange={setTab}
          options={[
            { value: "open", label: "Open" },
            { value: "closed", label: `Closed ${closedCount}` },
          ]}
        />
      ) : null}

      {groups.length === 0 ? (
        <p className="text-text-secondary bg-surface rounded-card border border-dashed px-4 py-6 text-center text-sm">
          {tab === "open" ? "Nothing open right now." : "Nothing closed yet."}
        </p>
      ) : (
        groups.map((group) => (
          <section
            key={group.kind}
            aria-label={KIND_META[group.kind].long}
            className="space-y-1.5"
          >
            <SectionHeader
              className="px-1"
              title={KIND_META[group.kind].long}
              count={group.rows.length}
              trailing={
                <span className="text-sm font-semibold">
                  <Amount value={BigInt(group.net)} whole />
                </span>
              }
            />
            <InvestmentList
              investments={group.rows}
              goals={goals}
              today={today}
              showKind={false}
            />
          </section>
        ))
      )}
    </div>
  );
}
