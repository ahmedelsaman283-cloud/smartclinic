import { CalendarDays, Home, ListChecks, Receipt, UsersRound, Users, Wallet } from "lucide-react";
import type { NavItem } from "./app-shell";

const iconClass = "h-5 w-5";

export const receptionNav: NavItem[] = [
  { to: "/reception", label: "الرئيسية", icon: <Home className={iconClass} /> },
  { to: "/reception/patients", label: "المرضى", icon: <Users className={iconClass} /> },
  { to: "/reception/appointments", label: "المواعيد", icon: <CalendarDays className={iconClass} /> },
  { to: "/reception/invoices", label: "الفواتير", icon: <Receipt className={iconClass} /> },
  { to: "/reception/accounts", label: "الحسابات", icon: <Wallet className={iconClass} /> },
];

export const doctorNav: NavItem[] = [
  { to: "/doctor", label: "قائمة اليوم", icon: <ListChecks className={iconClass} /> },
  { to: "/doctor/patients", label: "المرضى", icon: <Users className={iconClass} /> },
  { to: "/doctor/accounts", label: "الحسابات", icon: <Wallet className={iconClass} /> },
  { to: "/doctor/team", label: "الفريق", icon: <UsersRound className={iconClass} /> },
];
