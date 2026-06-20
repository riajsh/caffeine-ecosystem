"use server";

import { revalidatePath } from "next/cache";

import { inferCoAttendanceForOrg, inferSameCompanyConnections } from "@/lib/computed/infer-connections";
import { requireAdmin } from "@/lib/auth/session";

export async function inferAllCoAttendanceAction() {
  await requireAdmin();

  try {
    const result = await inferCoAttendanceForOrg();
    revalidatePath("/profiles");
    revalidatePath("/connect");
    revalidatePath("/events");
    return { success: true as const, ...result };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to run inference",
      created: 0,
      skipped: 0,
    };
  }
}

export async function inferSameCompanyAction() {
  await requireAdmin();

  try {
    const result = await inferSameCompanyConnections();
    revalidatePath("/profiles");
    revalidatePath("/connect");
    return { success: true as const, ...result };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to run inference",
      created: 0,
      skipped: 0,
    };
  }
}
