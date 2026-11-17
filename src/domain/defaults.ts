import type { AppData, EmailTemplate, Settings } from "./types";

export const DEFAULT_EMAIL_TEMPLATE: EmailTemplate = {
  subject: "Vacation request: {{employeeName}}, {{dateRange}}",
  body: `Dear {{managerName}},

I would like to request vacation for the following period:

From: {{from}}
To: {{to}}
Requested vacation days: {{days}}

{{balanceBlock}}
{{commentBlock}}
Please find my signed vacation request attached.
I would appreciate your confirmation.

Kind regards,
{{employeeName}}`,
};

/** Default template up to Nov 2026. Saved copies of it are upgraded automatically. */
export const LEGACY_EMAIL_TEMPLATE: EmailTemplate = {
  subject: "Vacation request: {{employeeName}}, {{dateRange}}",
  body: `Dear {{managerName}},

I would like to request vacation for the following period:

From: {{from}}
To: {{to}}
Requested vacation days: {{days}}

Vacation balance:
Previous year carryover: {{carryover}} days
Carryover deadline: {{carryoverDeadline}}
Current year remaining: {{currentRemaining}} days
Total available: {{totalAvailable}} days
Projected remaining balance after approval: {{projected}} days
{{commentBlock}}
Please find my signed vacation request attached.
I would appreciate your confirmation.

Kind regards,
{{employeeName}}`,
};

export function defaultSettings(currentYear: number): Settings {
  return {
    profile: {
      firstName: "",
      lastName: "",
      employeeId: "",
      company: "",
      department: "",
      jobTitle: "",
      employmentStart: "",
      annualEntitlement: 30,
      workdays: [1, 2, 3, 4, 5],
      country: "DE",
      region: "BW",
      personalEmail: "",
      managerName: "",
      managerEmail: "",
      language: "en",
    },
    policy: {
      prorationMethod: "fullMonthsRoundUp",
      carryoverDeadlineMonth: 3,
      carryoverDeadlineDay: 31,
      expiryPolicy: "expire",
      trackingStartYear: currentYear,
    },
    emailTemplate: { ...DEFAULT_EMAIL_TEMPLATE },
  };
}

export function emptyData(currentYear: number): AppData {
  return { settings: defaultSettings(currentYear), yearAccounts: [], adjustments: [], requests: [] };
}

export function isProfileComplete(s: Settings): boolean {
  const p = s.profile;
  return Boolean(p.firstName && p.lastName && p.company && p.employmentStart && p.managerEmail);
}
