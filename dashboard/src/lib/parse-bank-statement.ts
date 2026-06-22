import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { extractText, getDocumentProxy } from "unpdf";
import { z } from "zod";

const TransactionSchema = z.object({
  date: z
    .string()
    .describe("YYYY-MM-DD; year carried from statement period if missing on the row"),
  description: z.string().describe("Full transaction description, single line"),
  amountCents: z
    .number()
    .int()
    .describe("Positive integer cents. $142.50 → 14250. Never negative."),
  direction: z
    .enum(["credit", "debit"])
    .describe("'credit' = money in / deposit. 'debit' = money out / withdrawal."),
  balanceCents: z
    .number()
    .int()
    .nullable()
    .describe("Running balance after this row, integer cents. null if not visible."),
});

const StatementSchema = z.object({
  bsb: z.string().nullable(),
  accountNumber: z.string().nullable(),
  periodStart: z.string().nullable().describe("YYYY-MM-DD"),
  periodEnd: z.string().nullable().describe("YYYY-MM-DD"),
  openingBalanceCents: z.number().int().nullable(),
  closingBalanceCents: z.number().int().nullable(),
  transactions: z.array(TransactionSchema),
});

export type ParsedStatement = z.infer<typeof StatementSchema>;
export type ParsedTransaction = z.infer<typeof TransactionSchema>;

const SYSTEM_PROMPT = `You extract structured transactions from NAB (National Australia Bank) statement text.

Rules:
- Read every transaction row in the statement.
- amountCents is a positive integer of cents. $142.50 → 14250. Never use decimals or negatives.
- direction is "credit" for money flowing INTO the account (deposits, customer payments, interest received), "debit" for money flowing OUT (purchases, fees, transfers out).
- date is ISO YYYY-MM-DD. NAB statements often print "12 Mar" without the year — carry the year from the statement period.
- description: the full description line, trimmed. Strip duplicate whitespace.
- balanceCents: if the row shows a running balance, parse it as integer cents. Otherwise null.
- Skip header rows, opening/closing balance summary rows, page footers, and marketing inserts. Only return real transactions.
- If period dates aren't explicit, infer from the first/last transaction dates.
- Return strictly valid JSON matching the schema. Don't add commentary.`;

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const result = await extractText(pdf, { mergePages: true });
  return Array.isArray(result.text) ? result.text.join("\n") : result.text;
}

export async function parseStatement(buffer: Buffer): Promise<ParsedStatement> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  const text = await extractPdfText(buffer);
  if (text.trim().length < 100) {
    throw new Error("PDF text extraction produced almost no text — is this a scanned image?");
  }

  const client = new Anthropic();
  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: text }],
    output_config: { format: zodOutputFormat(StatementSchema) },
  });

  if (response.stop_reason === "refusal") {
    throw new Error(
      `Claude refused to parse the statement: ${response.stop_details?.explanation ?? "no detail"}`,
    );
  }
  if (!response.parsed_output) {
    throw new Error("Parser returned no structured output");
  }
  return response.parsed_output;
}
