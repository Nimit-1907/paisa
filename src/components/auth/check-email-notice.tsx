import { MailCheck } from "lucide-react";

/**
 * The panel both mail-sending screens end on.
 *
 * The Mailpit pointer only renders in development — in production there is no
 * such inbox, and telling users about one would be nonsense.
 */
export function CheckEmailNotice({
  title = "Check your email",
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-2xl border p-6 text-center">
      <span className="bg-income-soft text-income mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl">
        <MailCheck className="size-6" aria-hidden="true" />
      </span>

      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-muted-foreground mt-1 text-sm">{children}</p>

      {process.env.NODE_ENV === "development" ? (
        <p className="text-muted-foreground mt-4 text-xs">
          Developing locally? The mail is waiting in Mailpit at{" "}
          <a
            className="underline underline-offset-2"
            href="http://127.0.0.1:54324"
            target="_blank"
            rel="noopener noreferrer"
          >
            127.0.0.1:54324
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}
