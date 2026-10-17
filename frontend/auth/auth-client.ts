"use client";

import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

const client = createAuthClient({ plugins: [emailOTPClient()] });

export const authClient = client as typeof client & {
  signUp: typeof client.signUp & {
    email: (
      data: Parameters<typeof client.signUp.email>[0] & {
        requestedRole: string;
      },
    ) => ReturnType<typeof client.signUp.email>;
  };
  emailOtp: {
    verifyEmail: (data: { email: string; otp: string }) => Promise<{
      error?: { message?: string } | null;
    }>;
    requestPasswordReset: (data: { email: string }) => Promise<{
      error?: { message?: string } | null;
    }>;
    resetPassword: (data: { email: string; otp: string; password: string }) => Promise<{
      error?: { message?: string } | null;
    }>;
  };
};
