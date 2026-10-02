import { Calendar, CheckSquare, Mail, PenLine, Type, User, Building2, BadgeCheck, Signature } from "lucide-react";
import type { FieldType } from "./types";

export const FIELD_META: Record<FieldType, { label: string; icon: typeof PenLine; w: number; h: number; auto?: boolean }> = {
  signature: { label: "Signature", icon: Signature, w: 170, h: 52 },
  initials: { label: "Initials", icon: PenLine, w: 70, h: 44 },
  date: { label: "Date signed", icon: Calendar, w: 120, h: 26, auto: true },
  name: { label: "Full name", icon: User, w: 170, h: 26, auto: true },
  email: { label: "Email", icon: Mail, w: 190, h: 26, auto: true },
  company: { label: "Company", icon: Building2, w: 170, h: 26 },
  title: { label: "Job title", icon: BadgeCheck, w: 150, h: 26 },
  text: { label: "Text", icon: Type, w: 170, h: 26 },
  checkbox: { label: "Checkbox", icon: CheckSquare, w: 20, h: 20 },
};

export const FIELD_ORDER: FieldType[] = ["signature", "initials", "date", "name", "email", "company", "title", "text", "checkbox"];

export function todayString() {
  return new Date().toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}
