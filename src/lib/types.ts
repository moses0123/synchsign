import type { ObjectId } from "mongodb";

export type RecipientRole = "signer" | "approver" | "cc";
export type RecipientStatus = "pending" | "sent" | "viewed" | "signed" | "approved" | "declined";
export type EnvelopeStatus = "draft" | "sent" | "completed" | "declined" | "voided" | "expired";
export type FieldType = "signature" | "initials" | "date" | "name" | "email" | "text" | "checkbox" | "company" | "title";

export interface Recipient {
  id: string;
  name: string;
  email: string;
  role: RecipientRole;
  order: number;
  color: string;
  status: RecipientStatus;
  token: string;
  accessCode?: string | null;
  sentAt?: Date | null;
  viewedAt?: Date | null;
  completedAt?: Date | null;
  declineReason?: string | null;
  lastReminderAt?: Date | null;
  ip?: string | null;
}

export interface Field {
  id: string;
  recipientId: string;
  type: FieldType;
  page: number;       // 0-based
  x: number; y: number; w: number; h: number; // fractions of page size (0..1), origin top-left
  required: boolean;
  label?: string;
  value?: string | null; // text / "true" / data:image/png;base64 for signatures
}

export interface PageSize { w: number; h: number }

export interface Envelope {
  _id: ObjectId;
  ownerId: ObjectId;
  ownerName: string;
  ownerEmail: string;
  title: string;
  message: string;
  status: EnvelopeStatus;
  signingOrder: "sequential" | "parallel";
  fileId: ObjectId;
  fileName: string;
  completedFileId?: ObjectId | null;
  certificateFileId?: ObjectId | null;
  certificateHash?: string | null;
  pages: PageSize[];
  recipients: Recipient[];
  fields: Field[];
  originalHash: string;
  completedHash?: string | null;
  expiresAt?: Date | null;
  reminderDays?: number | null;
  voidReason?: string | null;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date | null;
  completedAt?: Date | null;
}

export interface Template {
  _id: ObjectId;
  ownerId: ObjectId;
  name: string;
  description: string;
  fileId: ObjectId;
  fileName: string;
  pages: PageSize[];
  roles: { id: string; name: string; role: RecipientRole; order: number; color: string }[];
  fields: Field[];
  signingOrder: "sequential" | "parallel";
  message: string;
  uses: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  _id: ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  company?: string;
  title?: string;
  signature?: string | null; // data URL
  initials?: string | null;  // data URL
  role?: "admin" | "user";
  disabled?: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
}

export const RECIPIENT_COLORS = ["#0ea5e9", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#14b8a6", "#6366f1"];
