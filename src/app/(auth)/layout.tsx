/** Centred, single-column frame for the signed-out screens. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      {children}
    </div>
  );
}
