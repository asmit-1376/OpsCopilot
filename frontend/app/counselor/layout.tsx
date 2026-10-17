import { requireRole } from "@/auth/authorization";

export default async function CounselorLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireRole("COUNSELOR");
  return children;
}
