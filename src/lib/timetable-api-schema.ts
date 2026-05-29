import { z } from "zod";

const ageGroupsField = z
  .array(z.string().min(1))
  .min(1)
  .optional();

const timetableSessionFieldsSchema = z.object({
  title: z.string().min(2).optional(),
  ageGroup: z.string().min(1).optional(),
  ageGroups: ageGroupsField,
  kind: z.enum(["training", "match"]),
  startsAt: z.string().min(8),
  endsAt: z.string().min(8),
  locationName: z.string().min(2),
  kitRequirements: z.string().optional(),
  trainerName: z.string().optional(),
  activities: z.array(z.string().min(1)).optional(),
  sessionObjectives: z.string().optional(),
  equipmentNotes: z.string().optional(),
  instructorNotes: z.string().optional()
});

function hasAgeGroup(d: { ageGroups?: string[]; ageGroup?: string }) {
  return (d.ageGroups?.length ?? 0) > 0 || Boolean(d.ageGroup?.trim());
}

export const timetableSessionBodySchema = timetableSessionFieldsSchema.refine(hasAgeGroup, {
  message: "Select at least one age group.",
  path: ["ageGroups"]
});

export const timetableSessionPatchSchema = timetableSessionFieldsSchema.partial().refine(
  (d) => {
    if (d.ageGroups === undefined && d.ageGroup === undefined) return true;
    return hasAgeGroup(d);
  },
  { message: "Select at least one age group.", path: ["ageGroups"] }
);

export type TimetableSessionBody = z.infer<typeof timetableSessionBodySchema>;
