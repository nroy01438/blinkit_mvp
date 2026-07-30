import { z } from "zod";
import { ATTRIBUTE_KEYS } from "@/lib/attributes";

export const AttributeAssessmentSchema = z.object({
  attribute: z.enum(ATTRIBUTE_KEYS as [string, ...string[]]),
  confidence: z.number().min(0).max(1),
  evidence: z.string().min(8).max(400),
  justification: z.string().min(4).max(220),
});

export const GraphResponseSchema = z.object({
  attributes: z.array(AttributeAssessmentSchema).min(1),
});

export type AttributeAssessment = z.infer<typeof AttributeAssessmentSchema>;
export type GraphResponse = z.infer<typeof GraphResponseSchema>;
