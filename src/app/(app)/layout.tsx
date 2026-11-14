import { BottomNav } from "@/components/layout/bottom-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { AddRecordFab } from "@/components/records/add-record-fab";

/**
 * App shell: bottom tab bar + FAB on phones, left sidebar from `lg` up, with
 * the content column capped at ~768px (CLAUDE.md).
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <SidebarNav />

      <div className="lg:pl-64">
        <main className="pb-nav mx-auto w-full max-w-3xl px-4 lg:px-6 lg:pb-16">
          {children}
        </main>
      </div>

      <BottomNav />
      <AddRecordFab />
    </div>
  );
}
