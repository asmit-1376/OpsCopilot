import { getAuthenticatedUser } from "@/auth/authorization";
import { mutateWorkspace, OperationError, readWorkspace } from "@/auth/operations";
import { prisma } from "@/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLIENT_OUT_OF_DATE =
  "The database client is out of date. Run `npx prisma generate` and restart the dev server.";

function ensureCurrentDatabaseClient() {
  if (!prisma.realtimeEvent) throw new OperationError(CLIENT_OUT_OF_DATE, 503);
}

async function authenticatedUser() {
  const user = await getAuthenticatedUser();
  if (!user) throw new OperationError("Please sign in to continue.", 401);
  return user;
}

function errorResponse(error: unknown) {
  if (error instanceof OperationError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error && typeof error === "object" && "code" in error) {
    const code = String(error.code);
    if (code === "P2002") return Response.json({ error: "A record with those details already exists." }, { status: 409 });
    if (code === "P2025") return Response.json({ error: "That record no longer exists. Refresh and try again." }, { status: 404 });
    if (code === "P2003") return Response.json({ error: "This change conflicts with linked institute records." }, { status: 409 });
  }
  const failure = error instanceof Error
    ? { name: error.name, message: error.message, code: "code" in error ? String(error.code) : undefined }
    : { message: String(error) };
  console.error("Institute operation failed.", failure);
  return Response.json({ error: "The change could not be saved. Please try again." }, { status: 500 });
}

export async function GET() {
  try {
    const user = await authenticatedUser();
    ensureCurrentDatabaseClient();
    return Response.json(await readWorkspace(user), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

async function writeOperation(request: Request, method: "POST" | "PATCH" | "DELETE") {
  try {
    const user = await authenticatedUser();
    ensureCurrentDatabaseClient();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new OperationError("Request body must be valid JSON.");
    }
    const result = await mutateWorkspace(user, method, body);
    return Response.json({ data: result }, { status: method === "POST" ? 201 : 200 });
  } catch (error) {
    return errorResponse(error);
  }
}

export function POST(request: Request) {
  return writeOperation(request, "POST");
}

export function PATCH(request: Request) {
  return writeOperation(request, "PATCH");
}

export function DELETE(request: Request) {
  return writeOperation(request, "DELETE");
}
