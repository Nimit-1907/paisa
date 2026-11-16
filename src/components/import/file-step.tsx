"use client";

import * as React from "react";

import { FileUp } from "lucide-react";

import { Card } from "@/components/shared/surface";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Step 1: the file.
 *
 * A button rather than the bare file input, which draws in the operating
 * system's style and at its size. Dropping a file on the card works too,
 * on anything with a pointer to drag with.
 */
export function FileStep({
  fileName,
  onFile,
}: {
  /** The file being previewed, if there is one. */
  fileName: string | null;
  onFile: (file: File) => void;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  const zone = React.useRef<HTMLDivElement>(null);
  const [over, setOver] = React.useState(false);

  // Kept current without re-attaching the listeners on every render.
  const latest = React.useRef(onFile);
  React.useEffect(() => {
    latest.current = onFile;
  });

  React.useEffect(() => {
    const node = zone.current;
    if (!node) return;

    const enter = (event: DragEvent) => {
      event.preventDefault();
      setOver(true);
    };
    const leave = () => setOver(false);
    const drop = (event: DragEvent) => {
      event.preventDefault();
      setOver(false);
      const file = event.dataTransfer?.files[0];
      if (file) latest.current(file);
    };

    node.addEventListener("dragover", enter);
    node.addEventListener("dragleave", leave);
    node.addEventListener("drop", drop);

    return () => {
      node.removeEventListener("dragover", enter);
      node.removeEventListener("dragleave", leave);
      node.removeEventListener("drop", drop);
    };
  }, []);

  return (
    <Card
      className={cn(
        "flex flex-col items-center gap-3 border-dashed px-4 py-6 text-center",
        over && "bg-surface-muted",
      )}
    >
      {/* The drop target is for a pointer; the button below is the way
          in for everyone else, so this is a labelled group, not a control.
          The listeners are attached in an effect for the same reason. */}
      <div
        ref={zone}
        role="group"
        aria-label="Drop a CSV file here"
        className="flex w-full flex-col items-center gap-3"
      >
        <span className="bg-surface-muted text-text-secondary rounded-card flex size-12 items-center justify-center">
          <FileUp className="size-6" aria-hidden="true" />
        </span>

        <div>
          <p className="text-sm font-semibold">
            {fileName ?? "A CSV from your bank or another app"}
          </p>
          <p className="text-text-secondary text-xs">
            Up to 2 MB. It is read on this device, and nothing is sent until
            you import.
          </p>
        </div>

        <Button
          type="button"
          size="touch"
          variant={fileName ? "secondary" : "default"}
          onClick={() => input.current?.click()}
        >
          {fileName ? "Choose another file" : "Choose a CSV file"}
        </Button>

        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          aria-label="CSV file"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Cleared, so choosing the same file again still fires.
            event.target.value = "";
            if (file) onFile(file);
          }}
        />
      </div>
    </Card>
  );
}
