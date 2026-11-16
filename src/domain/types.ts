/** ISO date string "YYYY-MM-DD" (local calendar date, no time zone). */
export type ISODate = string;

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

export type ProrationMethod = "fullMonthsRoundUp" | "fullMonthsRound" | "exactDays" | "none";
export type ExpiryPolicy = "expire" | "keep";
export type RequestStatus = "draft" | "pending" | "approved" | "rejected" | "withdrawn";
export type Bucket = "carryover" | "current";

export interface Profile {
  firstName: string;
  lastName: string;
  employeeId: string;
  company: string;
  department: string;
  jobTitle: string;
  employmentStart: ISODate;
  annualEntitlement: number;
  workdays: number[]; // weekdays that are working days, 0 = Sunday
  country: string; // "DE" or "OTHER"
  region: string; // German state code, e.g. "BW"
  personalEmail: string;
  managerName: string;
  managerEmail: string;
  language: string;
}

export interface Policy {
  prorationMethod: ProrationMethod;
  /** Month (1-12) and day of the carryover deadline in the following year. */
  carryoverDeadlineMonth: number;
  carryoverDeadlineDay: number;
  expiryPolicy: ExpiryPolicy;
  /** First calendar year tracked in the app. Its carryover is entered manually. */
  trackingStartYear: number;
}

export interface EmailTemplate {
  subject: string;
  body: string;
}

export interface Settings {
  profile: Profile;
  policy: Policy;
  emailTemplate: EmailTemplate;
}

/** Per-year overrides. Empty fields mean "calculate automatically". */
export interface YearAccount {
  year: number;
  entitlementOverride?: number | null;
  carryoverOverride?: number | null;
  carryoverDeadlineOverride?: ISODate | null;
  note?: string;
}

export interface Adjustment {
  id: string;
  year: number;
  bucket: Bucket;
  /** Positive adds days, negative removes days. */
  days: number;
  reason: string;
  createdAt: string; // ISO timestamp
}

export interface RequestDay {
  date: ISODate;
  /** 1 = full day, 0.5 = half day */
  value: number;
}

export interface Signature {
  dataUrl: string; // PNG data URL
  signedAt: string; // ISO timestamp
}

export interface StatusChange {
  status: RequestStatus;
  at: string; // ISO timestamp
  note?: string;
}

export interface BalanceSnapshot {
  year: number;
  carryoverAvailable: number;
  carryoverDeadline: ISODate;
  currentAvailable: number;
  totalAvailable: number;
  /** Days already reserved by other pending requests in the same year. */
  reservedByPending: number;
  requested: number;
  fromCarryover: number;
  fromCurrent: number;
  projected: number;
  /** Days of this request that fall into the following year, if any. */
  nextYearDays: number;
}

export interface VacationRequest {
  id: string;
  number: string; // e.g. VR-2027-003
  start: ISODate;
  end: ISODate;
  days: RequestDay[];
  comment: string;
  status: RequestStatus;
  signature: Signature | null;
  statusHistory: StatusChange[];
  createdAt: string;
  updatedAt: string;
  sentAt?: string | null;
  sentVia?: "email" | "mailto" | "manual" | null;
  /** Balance block frozen at the moment the request was sent. */
  snapshot?: BalanceSnapshot | null;
}

export interface AppData {
  settings: Settings;
  yearAccounts: YearAccount[];
  adjustments: Adjustment[];
  requests: VacationRequest[];
}
