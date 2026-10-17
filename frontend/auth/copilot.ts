import { createHash, createHmac, randomUUID } from "node:crypto";
import type { Role } from "@prisma/client";
import { getAuthenticatedUser } from "@/auth/authorization";
import { prisma } from "@/prisma";

export class CopilotError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export type CopilotUser = {
  id: string;
  instituteId: string;
  role: "TRAINER" | "COUNSELOR" | "OWNER";
  name: string;
  email: string;
  trainerId: string | null;
};

export async function requireCopilotUser(): Promise<CopilotUser> {
  const user = await getAuthenticatedUser();
  if (!user) throw new CopilotError("Please sign in to use Copilot.", 401);
  if (user.role !== "TRAINER" && user.role !== "COUNSELOR" && user.role !== "OWNER") {
    throw new CopilotError("Copilot is available to owners, trainers, and counselors only.", 403);
  }

  const trainer = user.role === "TRAINER"
    ? await prisma.trainer.findFirst({
        where: { userId: user.id, instituteId: user.instituteId },
        select: { id: true },
      })
    : null;
  if (user.role === "TRAINER" && !trainer) {
    throw new CopilotError("Your trainer profile is not linked to this account.", 403);
  }

  return {
    id: user.id,
    instituteId: user.instituteId,
    role: user.role,
    name: user.name,
    email: user.email,
    trainerId: trainer?.id ?? null,
  };
}

export function copilotErrorResponse(error: unknown) {
  if (error instanceof CopilotError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error("Copilot API failed.", {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : "Unexpected failure",
  });
  return Response.json({ error: "Copilot could not complete that request." }, { status: 500 });
}

export function backendUrl(path: string) {
  const base = (process.env.AI_BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function signedServiceHeaders(body: string) {
  const secret = process.env.COPILOT_SERVICE_SECRET?.trim();
  if (!secret) throw new CopilotError("Copilot service authentication is not configured.", 503);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}\n${body}`)
    .digest("hex");
  return {
    "content-type": "application/json",
    "x-copilot-timestamp": timestamp,
    "x-copilot-signature": signature,
  };
}

export function redactPrompt(prompt: string) {
  return prompt
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/(?:\+?91[\s-]?)?[6-9]\d(?:[\s-]?\d){8}/g, "[phone]");
}

export function validRequestId(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return null;
  }
  return value;
}

export function normalizeIndianMobile(value: string | null | undefined) {
  if (!value) return null;
  let digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export function maskMobile(value: string) {
  return `••••••${value.slice(-4)}`;
}

export async function findCopilotRecipient(studentId: string, user: CopilotUser) {
  const trainerScope = user.role === "TRAINER"
    ? { trainerAssignments: { some: { trainerId: user.trainerId! } } }
    : {};
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      instituteId: user.instituteId,
      status: "ACTIVE",
      enrollments: {
        some: {
          instituteId: user.instituteId,
          status: "ACTIVE",
          batch: { is: { status: "ACTIVE", ...trainerScope } },
        },
      },
    },
    select: { id: true, name: true, phone: true, guardianPhone: true },
  });
  if (!student) {
    throw new CopilotError("That student is not in your authorized institute scope.", 403);
  }
  const mobile = normalizeIndianMobile(student.phone) ?? normalizeIndianMobile(student.guardianPhone);
  if (!mobile) throw new CopilotError("No valid WhatsApp contact is recorded for this student.", 409);
  return { id: student.id, name: student.name, mobile, maskedMobile: maskMobile(mobile) };
}

export async function createWhatsAppProposal(args: {
  requestId: string;
  studentId: string;
  message: string;
  user: CopilotUser;
}) {
  if (!args.message.trim() || args.message.length > 4096) {
    throw new CopilotError("The WhatsApp draft is empty or too long.", 422);
  }
  const recipient = await findCopilotRecipient(args.studentId, args.user);
  const payload = {
    recipientStudentId: recipient.id,
    recipientName: recipient.name,
    recipientMaskedMobile: recipient.maskedMobile,
    message: args.message.trim(),
  };
  const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const proposal = await prisma.actionProposal.create({
    data: {
      instituteId: args.user.instituteId,
      requestId: args.requestId,
      actionType: "WHATSAPP_SEND",
      payload,
      payloadHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    select: { id: true, status: true, expiresAt: true },
  });
  return {
    id: proposal.id,
    status: proposal.status,
    expiresAt: proposal.expiresAt,
    recipientName: recipient.name,
    recipientMaskedMobile: recipient.maskedMobile,
    message: payload.message,
  };
}

export function makeRequestId() {
  return randomUUID();
}

export function roleForBackend(role: Role) {
  if (role === "TRAINER") return "trainer" as const;
  if (role === "COUNSELOR") return "counselor" as const;
  if (role === "OWNER") return "owner" as const;
  throw new CopilotError("Copilot is available to owners, trainers, and counselors only.", 403);
}
