import { CopilotError, copilotErrorResponse, requireCopilotUser } from "@/auth/copilot";
import { prisma } from "@/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireCopilotUser();
    const threads = await prisma.copilotThread.findMany({
      where: { instituteId: user.instituteId, userId: user.id, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, title: true, createdAt: true, updatedAt: true, activeRequestId: true },
    });
    return Response.json({ threads }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return copilotErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCopilotUser();
    let title = "New conversation";
    try {
      const body = await request.json() as { title?: unknown };
      if (typeof body.title === "string" && body.title.trim()) title = body.title.trim().slice(0, 120);
    } catch {
      throw new CopilotError("Request body must be valid JSON.", 400);
    }
    const thread = await prisma.copilotThread.create({
      data: { instituteId: user.instituteId, userId: user.id, title },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
    return Response.json({ thread }, { status: 201 });
  } catch (error) {
    return copilotErrorResponse(error);
  }
}
