import { z } from "zod";
import { toToolJsonSchema } from "./json-schema.js";

export const SEND_MESSAGE_TOOL_NAME = "SendMessage";
export const SEND_MESSAGE_MAX_CONTENT_CHARS = 20_000;

export const SendMessageInputSchema = z
  .object({
    to: z
      .string()
      .min(1)
      .max(200)
      .describe("Recipient: local agent ID returned by Agent (format agent_<uuid>)."),
    summary: z
      .string()
      .min(1)
      .max(200)
      .describe("A 5-10 word summary shown as a preview in the UI."),
    message: z
      .string()
      .min(1)
      .max(SEND_MESSAGE_MAX_CONTENT_CHARS)
      .describe("Plain text message content"),
    requires_answer: z
      .boolean()
      .optional()
      .describe(
        "Mark this message as a decision the worker must answer before continuing. " +
          "This is your own lock, not a global guard: use it only when that front cannot " +
          "advance without the answer, and mark its plan item waiting with the question.",
      ),
  })
  .strict();

export type SendMessageInput = z.infer<typeof SendMessageInputSchema>;

export const SendMessageInputJsonSchema = toToolJsonSchema(SendMessageInputSchema);

export const SendMessageOutputSchema = z
  .object({
    status: z.enum(["success", "failed"]),
    messageId: z.string(),
    agentId: z.string().optional(),
    delivery: z.enum(["queued", "steered", "resumed_background"]).optional(),
    error: z.string().optional(),
    message: z.string().optional(),
    outputFile: z.string().optional(),
    taskId: z.string().optional(),
    /** El worker queda esperando la respuesta que pidió el orquestador. */
    waitingForAnswer: z.boolean().optional(),
  })
  .strict();

export type SendMessageOutput = z.infer<typeof SendMessageOutputSchema>;

export const SendMessageOutputJsonSchema = toToolJsonSchema(SendMessageOutputSchema);
