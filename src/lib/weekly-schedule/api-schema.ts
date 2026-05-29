import { z } from "zod";
import { AGE_GROUPS } from "@/lib/age-groups";

const baseFields = {
  startsAt: z.string().min(8),
  endsAt: z.string().min(8),
  pitchId: z.string().min(1)
};

export const sessionBodySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("training"),
    ...baseFields,
    ageGroups: z.array(z.enum(AGE_GROUPS)).min(1),
    coachIds: z.array(z.string().min(1)).min(1),
    period: z.enum(["morning", "afternoon"]),
    trainingTopic: z.string().max(500).optional().default(""),
    objectives: z.string().max(2000).optional().default(""),
    kit: z.string().max(500).optional().default(""),
    teamA: z.string().optional().default(""),
    teamB: z.string().optional().default(""),
    matchNotes: z.string().optional().default("")
  }),
  z.object({
    type: z.literal("match"),
    ...baseFields,
    teamA: z.string().min(1),
    teamB: z.string().min(1),
    ageGroups: z.array(z.enum(AGE_GROUPS)).optional().default([]),
    coachIds: z.array(z.string().min(1)).optional().default([]),
    period: z.enum(["morning", "afternoon"]).optional().default("afternoon"),
    trainingTopic: z.string().optional().default(""),
    objectives: z.string().optional().default(""),
    kit: z.string().optional().default(""),
    matchNotes: z.string().max(2000).optional().default("")
  }),
  z.object({
    type: z.literal("rest"),
    ...baseFields,
    ageGroups: z.array(z.enum(AGE_GROUPS)).optional().default([]),
    coachIds: z.array(z.string().min(1)).optional().default([]),
    period: z.enum(["morning", "afternoon"]).optional().default("afternoon"),
    trainingTopic: z.string().max(500).optional().default("Recovery / rest"),
    objectives: z.string().max(2000).optional().default(""),
    kit: z.string().max(500).optional().default(""),
    teamA: z.string().optional().default(""),
    teamB: z.string().optional().default(""),
    matchNotes: z.string().max(2000).optional().default("")
  })
]);

export const createWeekSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const coachBodySchema = z.object({
  name: z.string().min(2).max(120)
});

export const pitchBodySchema = z.object({
  name: z.string().min(2).max(120)
});

/** Teams available for match-day dropdowns (squads + common opponents). */
export const SCHEDULE_TEAMS = [...AGE_GROUPS, "Guest XI", "Academy Select"] as const;
