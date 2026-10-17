import { requireRole } from "@/auth/authorization";
import RealtimeRefresh from "@/app/realtime-refresh";

export default async function StudentLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireRole("STUDENT");
  return <><RealtimeRefresh />{children}</>;
}
