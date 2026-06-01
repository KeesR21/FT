import { randomUUID } from "crypto";
import { connectMongo } from "@/lib/db/mongo-client";
import { isMongoConfigured } from "@/lib/db/mongo-client";
import { ContactSubmissionModel } from "@/lib/db/mongo-models";
import type { ContactSubmission } from "@/lib/types";

function rowToSubmission(doc: Record<string, unknown>): ContactSubmission {
  return {
    id: String(doc._id ?? ""),
    name: String(doc.name ?? ""),
    email: String(doc.email ?? ""),
    message: String(doc.message ?? ""),
    enquiryType: doc.enquiry_type ? String(doc.enquiry_type) : undefined,
    createdAt: String(doc.created_at ?? new Date().toISOString()),
    readAt: doc.read_at ? String(doc.read_at) : null,
    deletedAt: doc.deleted_at ? String(doc.deleted_at) : null
  };
}

export async function createContactSubmission(input: {
  name: string;
  email: string;
  message: string;
  enquiryType?: string;
}): Promise<ContactSubmission | null> {
  if (!isMongoConfigured()) return null;
  await connectMongo();
  const id = randomUUID();
  const doc = await ContactSubmissionModel.create({
    _id: id,
    name: input.name,
    email: input.email,
    message: input.message,
    enquiry_type: input.enquiryType ?? null
  });
  return rowToSubmission(doc.toObject() as Record<string, unknown>);
}

export async function listContactSubmissions(opts?: {
  includeDeleted?: boolean;
}): Promise<ContactSubmission[]> {
  if (!isMongoConfigured()) return [];
  await connectMongo();
  const filter: Record<string, unknown> = opts?.includeDeleted ? {} : { deleted_at: null };
  const docs = await ContactSubmissionModel.find(filter).sort({ created_at: -1 }).limit(200).lean();
  return (docs as Array<Record<string, unknown>>).map(rowToSubmission);
}
