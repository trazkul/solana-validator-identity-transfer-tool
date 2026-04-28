export type EdgeCaseOption =
  | "successful-transfer"
  | "destination-not-synced"
  | "missing-tower-file"
  | "duplicate-identity-detected"
  | "invalid-keypair"
  | "transfer-failure";

export const demoSource = {
  host: "source-validator.demo.local",
  user: "solana",
  ledgerPath: "/mnt/ledger",
  publicKey: "8Fv4D8sHgWmRcE4VYVbQ6YQb8tKuE4QG3wJ6iJ8q2s7P",
  status: "Active / Voting",
};

export const demoDestination = {
  host: "destination-validator.demo.local",
  user: "solana",
  ledgerPath: "/mnt/ledger",
  temporaryIdentity: "7Jk2NgxC6pQY5mJf9wLhT1gKe2Vb4aEpQ3uR5nLt8hDz",
  syncStatus: "Synced / Ready",
};

export const edgeCaseLabels: Record<EdgeCaseOption, string> = {
  "successful-transfer": "Successful transfer",
  "destination-not-synced": "Destination not synced",
  "missing-tower-file": "Missing tower file",
  "duplicate-identity-detected": "Duplicate identity detected",
  "invalid-keypair": "Invalid keypair",
  "transfer-failure": "Transfer failure",
};

export const dryRunPlan = [
  "Create tower file backup on source validator",
  "Switch source validator to temporary unstaked identity",
  "Remove source authorized voter state where applicable",
  "Transfer encrypted validator identity payload",
  "Decrypt and apply validator identity on destination side",
  "Verify destination validator identity",
  "Verify source no longer uses original identity",
  "Show final operator report",
];

export const executionTimeline = [
  "Tower backup created",
  "Source validator switched to temporary identity",
  "Encrypted identity payload transferred",
  "Destination identity updated",
  "Validator state refreshed",
  "Final verification completed",
];

export const preflightDefinitions = [
  "Source validator reachable",
  "Destination validator reachable",
  "Destination validator is synced",
  "Ledger paths detected",
  "Tower file detected",
  "Tower backup path available",
  "No duplicate active identity detected",
  "Encrypted identity payload ready",
] as const;
