"use server";

// Real implementation lives below; wired in task 12.
export async function sendInvoiceEmailAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const { sendInvoiceEmail } = await import("@/lib/email");
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { ok: false, error: "Invalid id" };
  return sendInvoiceEmail(id);
}
