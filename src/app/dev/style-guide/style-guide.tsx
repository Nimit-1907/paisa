"use client";

import * as React from "react";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  Repeat,
  Wallet,
} from "lucide-react";

import { FieldCard } from "@/components/shared/field-card";
import { HeroSplit, HeroStat } from "@/components/shared/hero-stat";
import { InsightStrip } from "@/components/shared/insight-strip";
import { Pill } from "@/components/shared/pill";
import { ProgressBar } from "@/components/shared/progress-bar";
import { SectionHeader } from "@/components/shared/section-header";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { Card, HeroCard, ListCard } from "@/components/shared/surface";
import { Tile } from "@/components/shared/tile";
import { TilePicker } from "@/components/shared/tile-picker";
import { TintPicker } from "@/components/shared/tint-picker";
import { DateTile } from "@/components/shared/date-tile";
import {
  RangeCalendar,
  RangePresetPills,
} from "@/components/shared/range-calendar";
import { Stepper } from "@/components/shared/stepper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PALETTE, TINT_KEYS, contrast } from "@/lib/tokens";

/** Both themes, same content, so a difference is a difference. */
export function StyleGuide() {
  return (
    <div className="min-h-dvh">
      <div className="grid lg:grid-cols-2">
        <Panel theme="light" />
        <Panel theme="dark" />
      </div>
    </div>
  );
}

function Panel({ theme }: { theme: "light" | "dark" }) {
  return (
    <div className={theme === "dark" ? "dark" : undefined}>
      <div className="bg-background text-text min-h-dvh px-4 py-6">
        <p className="text-text-secondary mb-6 text-xs font-semibold">
          {theme === "dark" ? "Dark" : "Light"}
        </p>

        <div className="mx-auto w-full max-w-sm space-y-10">
          <Colours theme={theme} />
          <Tints theme={theme} />
          <TypeScale />
          <Depth />
          <Heroes />
          <Lists />
          <Controls />
          <Pickers />
          <Progress />
          <Feedback />
        </div>
      </div>
    </div>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg tracking-[-0.03em]">{title}</h2>
      {children}
    </section>
  );
}

function Colours({ theme }: { theme: "light" | "dark" }) {
  const p = PALETTE[theme];

  const swatches: [string, string, string | null][] = [
    ["background", p.background, null],
    ["surface", p.surface, null],
    ["surface-muted", p.surfaceMuted, null],
    ["ink", p.ink, p.onInk],
    ["text", p.text, p.surface],
    ["text-secondary", p.textSecondary, p.surface],
    ["hairline", p.hairline, null],
    ["bar-muted", p.barMuted, null],
    ["income", p.income, p.surface],
    ["expense", p.expense, p.surface],
    ["transfer", p.transfer, p.surface],
    ["accent", p.accent, p.text],
  ];

  return (
    <Group title="Colour">
      <ul className="grid grid-cols-2 gap-2">
        {swatches.map(([name, hex, against]) => (
          <li key={name} className="rounded-control border p-2">
            <span
              className="block h-8 rounded-[9px] border"
              style={{ backgroundColor: hex }}
            />
            <span className="mt-1.5 block text-[11px] font-semibold">
              {name}
            </span>
            <span className="text-text-secondary block font-mono text-[10px]">
              {hex}
              {against ? ` · ${contrast(hex, against).toFixed(1)}:1` : ""}
            </span>
          </li>
        ))}
      </ul>
    </Group>
  );
}

function Tints({ theme }: { theme: "light" | "dark" }) {
  return (
    <Group title="Tints">
      <ul className="grid grid-cols-4 gap-2">
        {TINT_KEYS.map((key) => (
          <li key={key} className="text-center">
            <Tile tint={key} icon="Tag" size="lg" className="mx-auto" />
            <span className="mt-1 block text-[10px] font-medium">{key}</span>
            <span className="text-text-secondary block font-mono text-[9px]">
              {contrast(PALETTE[theme].text, PALETTE[theme].tints[key]).toFixed(
                1,
              )}
              :1
            </span>
          </li>
        ))}
      </ul>
    </Group>
  );
}

function TypeScale() {
  return (
    <Group title="Type">
      <div className="space-y-2">
        <p className="font-display text-[28px] leading-tight tracking-[-0.03em]">
          Page title · 28
        </p>
        <p className="font-display text-[42px] leading-none tracking-[-0.03em]">
          42,850
        </p>
        <p className="text-sm font-semibold">Section title · 14/600</p>
        <p className="text-sm">Body · 14</p>
        <p className="text-text-secondary text-xs">Secondary · 12</p>
        <p className="amount text-sm font-semibold">
          <span className="amount-unit">₹</span>1,23,456
          <span className="amount-minor">.78</span>
        </p>
      </div>
    </Group>
  );
}

function Depth() {
  return (
    <Group title="Depth">
      <div className="space-y-3">
        <Card className="p-3 text-xs">Flat · 1px hairline, no shadow</Card>
        <div className="bg-surface rounded-card accent-sm mr-1 mb-1 p-3 text-xs">
          accent-sm · 1.5px ink + 2px 2px 0
        </div>
        <div className="bg-surface rounded-hero accent-lg mr-1 mb-1 p-3 text-xs">
          accent-lg · 1.5px ink + 4px 4px 0
        </div>
      </div>
    </Group>
  );
}

function Heroes() {
  return (
    <Group title="Hero">
      <HeroStat
        label="Left to spend"
        trend={<Pill tone="income">↘ 12% less than Oct</Pill>}
        value={
          <>
            <span className="amount-unit">₹</span>18,450
          </>
        }
        helper="₹1,153 a day · 16 days left"
        split={
          <>
            <HeroSplit
              tint="bg-tint-mint"
              icon={<ArrowDownLeft className="size-3.5" />}
              label="Income"
              value="+₹62,000"
            />
            <HeroSplit
              tint="bg-tint-rose"
              icon={<ArrowUpRight className="size-3.5" />}
              label="Spent"
              value="−₹43,550"
            />
          </>
        }
      >
        <div className="mt-3 flex h-10 items-end gap-[3px]">
          {[30, 55, 20, 80, 45, 60, 35, 90, 25, 50, 70, 40].map((h, i) => (
            <span
              key={i}
              className={
                i === 7
                  ? "bg-accent border-ink flex-1 rounded-[3px] border-[1.5px]"
                  : "bg-bar-muted flex-1 rounded-[3px]"
              }
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </HeroStat>

      <InsightStrip>Food is 18% lower than last week. Nice.</InsightStrip>
    </Group>
  );
}

function Lists() {
  const rows = [
    {
      tint: "rose",
      icon: "UtensilsCrossed",
      name: "Food",
      sub: "Lunch with team · HDFC",
      amount: "−₹450",
      tone: "text-expense",
    },
    {
      tint: "peach",
      icon: "ShoppingBasket",
      name: "Groceries",
      sub: "Weekly veggies · Cash",
      amount: "−₹750",
      tone: "text-expense",
    },
    {
      tint: "mint",
      icon: "Banknote",
      name: "Salary",
      sub: "November · HDFC",
      amount: "+₹62,000",
      tone: "text-income",
    },
    {
      tint: "sky",
      icon: "ArrowLeftRight",
      name: "Transfer",
      sub: "HDFC → Cash",
      amount: "₹2,000",
      tone: "text-transfer",
    },
  ];

  return (
    <Group title="List">
      <SectionHeader
        title="Today"
        trailing={<span className="text-text-secondary text-xs">−₹1,240</span>}
      />
      <ListCard>
        {rows.map((row) => (
          <li key={row.name} className="flex items-center gap-3 px-3.5 py-2.5">
            <Tile tint={row.tint} icon={row.icon} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold">
                  {row.name}
                </span>
                {row.name === "Salary" ? (
                  <Repeat className="text-text-secondary size-3" />
                ) : null}
              </span>
              <span className="text-text-secondary block truncate text-xs">
                {row.sub}
              </span>
            </span>
            <span className={`amount text-sm font-semibold ${row.tone}`}>
              {row.amount}
            </span>
          </li>
        ))}
      </ListCard>

      <div className="space-y-2">
        <ProgressBar percent={62} label="Under" />
        <ProgressBar percent={88} label="Close" />
        <ProgressBar percent={120} label="Over" />
      </div>
    </Group>
  );
}

function Controls() {
  const [type, setType] = React.useState("expense");
  const [picked, setPicked] = React.useState("food");

  return (
    <Group title="Controls">
      <SegmentedControl
        label="Record type"
        value={type}
        onChange={setType}
        options={[
          { value: "expense", label: "Expense" },
          { value: "income", label: "Income" },
          { value: "transfer", label: "Transfer" },
        ]}
      />

      <TilePicker
        label="Category"
        value={picked}
        onChange={setPicked}
        options={[
          { id: "food", name: "Food", icon: "UtensilsCrossed", tint: "rose" },
          {
            id: "groceries",
            name: "Groceries",
            icon: "ShoppingBasket",
            tint: "peach",
          },
          { id: "transport", name: "Transport", icon: "Bus", tint: "sky" },
          { id: "bills", name: "Bills", icon: "ReceiptText", tint: "butter" },
        ]}
      />

      <div className="grid grid-cols-2 gap-2">
        <FieldCard
          label="Account"
          icon={<Wallet className="size-3.5" />}
          value="HDFC"
          onClick={() => {}}
        />
        <FieldCard
          label="When"
          icon={<Calendar className="size-3.5" />}
          value="Today, 1:30 pm"
          onClick={() => {}}
        />
      </div>

      <Input placeholder="Lunch with team" />

      <div className="flex flex-wrap gap-2">
        <Button size="touch" className="w-full">
          Save expense · ₹450 →
        </Button>
        <Button variant="secondary" size="touch">
          Secondary
        </Button>
        <Button variant="ghost" size="touch">
          Ghost
        </Button>
        <Button variant="destructive" size="touch">
          Delete
        </Button>
        <Button variant="accent" size="icon-touch" aria-label="Add">
          +
        </Button>
        <Button size="touch" disabled>
          Disabled
        </Button>
      </div>
    </Group>
  );
}

/** The three pickers Phase 14 added after the first style-guide pass. */
function Pickers() {
  const [tint, setTint] = React.useState("peri");
  const [every, setEvery] = React.useState("2");
  const [range, setRange] = React.useState({
    from: "2026-11-03",
    to: "2026-11-15",
  });

  return (
    <Group title="Pickers">
      <TintPicker value={tint} onChange={setTint} />

      <div className="flex items-center gap-3">
        <DateTile day="2026-12-03" />
        <DateTile day={null} />
        <Stepper label="Every how many" value={every} onChange={setEvery} />
      </div>

      <div className="bg-surface rounded-card border p-4">
        <RangePresetPills
          from={range.from}
          to={range.to}
          today="2026-11-15"
          onSelect={setRange}
          className="mb-3"
        />
        <RangeCalendar
          from={range.from}
          to={range.to}
          max="2026-11-15"
          today="2026-11-15"
          onChange={setRange}
        />
      </div>
    </Group>
  );
}

/** The budget bar at each of its three thresholds. */
function Progress() {
  return (
    <Group title="Progress">
      <ProgressBar percent={34} label="Under: ink" />
      <ProgressBar percent={88} label="Close: butter with an ink border" />
      <ProgressBar percent={140} label="Over: rose with an ink border" />
    </Group>
  );
}

function Feedback() {
  return (
    <Group title="Feedback">
      <div className="bg-surface rounded-toast flex items-center gap-2.5 border px-3 py-2.5">
        <span className="bg-tint-mint text-text flex size-7 items-center justify-center rounded-[9px]">
          ✓
        </span>
        <span className="flex-1 text-[13px] font-medium">
          Expense saved · ₹450
        </span>
        <button
          type="button"
          className="text-text text-xs font-semibold underline"
        >
          Undo
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Pill tone="income">Income</Pill>
        <Pill tone="expense">Over by ₹400</Pill>
        <Pill tone="transfer">Transfer</Pill>
        <Pill tone="warning">Goes negative</Pill>
        <Pill tone="accent">Repeats monthly</Pill>
        <Pill>Quiet</Pill>
      </div>

      <Card className="space-y-2 p-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-3 w-32" />
      </Card>

      <HeroCard className="text-center">
        <p className="text-sm font-semibold">Nothing here yet</p>
        <p className="text-text-secondary mt-1 text-xs">
          One sentence, one button.
        </p>
        <Button size="touch" className="mt-3">
          Add record
        </Button>
      </HeroCard>
    </Group>
  );
}
