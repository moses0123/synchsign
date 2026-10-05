import type { Field, PageSize, RecipientRole, RecipientStatus, EnvelopeStatus } from "./types";

export interface ClientRecipient {
  id: string; name: string; email: string; role: RecipientRole; order: number; color: string;
  status: RecipientStatus; token: string; accessCode?: string | null; link?: string; verifyEmail?: boolean; emailVerifiedAt?: string | null;
  sentAt?: string | null; viewedAt?: string | null; completedAt?: string | null; declineReason?: string | null;
}
export interface ClientEnvelope {
  _id: string; title: string; message: string; status: EnvelopeStatus; signingOrder: "sequential" | "parallel";
  fileName: string; completedFileId: string | null; certificateFileId?: string | null; certificateHash?: string | null; pages: PageSize[]; recipients: ClientRecipient[]; fields: Field[];
  ownerName: string; ownerEmail: string;
  originalHash: string; completedHash?: string | null; expiresAt?: string | null; reminderDays?: number | null;
  voidReason?: string | null; tags?: string[]; createdAt: string; updatedAt: string; sentAt?: string | null; completedAt?: string | null;
}
export type { Field, PageSize };
