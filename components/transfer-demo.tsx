"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  demoDestination,
  demoSource,
  dryRunPlan,
  edgeCaseLabels,
  executionTimeline,
  preflightDefinitions,
  type EdgeCaseOption,
} from "@/lib/demo-data";
import {
  derivePublicKey,
  encryptKeypair,
  generateDemoKeypair,
  maskPublicKey,
  type EncryptedPayload,
  validateKeypairArray,
} from "@/lib/crypto";

type ValidatorForm = {
  host: string;
  user: string;
  ledgerPath: string;
  publicKey: string;
  status: string;
};

type CheckStatus =
  | "idle"
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "warning";

type PreflightCheck = {
  name: string;
  status: CheckStatus;
  detail: string;
};

type ExecutionStep = {
  label: string;
  status: CheckStatus;
  detail: string;
};

const stepTitles = [
  "Source Validator",
  "Destination Validator",
  "Identity Key",
  "Client-side Encryption",
  "Preflight Checks",
  "Dry Run Plan",
  "Transfer Execution",
  "Final Result",
];

const edgeCaseDescriptions: Record<EdgeCaseOption, string> = {
  "successful-transfer":
    "Simulation completes without warnings and demonstrates the happy path.",
  "destination-not-synced":
    "Preflight blocks execution because the destination validator is not ready to take over voting.",
  "missing-tower-file":
    "Preflight blocks execution because tower state is required before a safe validator identity transfer can continue.",
  "duplicate-identity-detected":
    "The tool prevents a risky overlap where the same identity could remain active on both servers.",
  "invalid-keypair":
    "Client-side validation stops the flow before any encryption or transfer steps start.",
  "transfer-failure":
    "Execution halts mid-transfer and surfaces a rollback recommendation for operators.",
};

const successResult = {
  sourceIdentity: "temporary unstaked identity",
  sourceStatus: "safe / no longer voting as original identity",
  destinationIdentity: "original validator identity",
  destinationStatus: "active / ready",
};

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function statusClasses(status: CheckStatus) {
  switch (status) {
    case "success":
      return "status-pill bg-emerald-100 text-emerald-700";
    case "failed":
      return "status-pill bg-rose-100 text-rose-700";
    case "warning":
      return "status-pill bg-amber-100 text-amber-700";
    case "pending":
    case "running":
      return "status-pill bg-sky-100 text-sky-700";
    default:
      return "status-pill bg-slate-100 text-slate-600";
  }
}

function createInitialChecks(): PreflightCheck[] {
  return preflightDefinitions.map((name) => ({
    name,
    status: "idle",
    detail: "Waiting to run in Simulation Mode.",
  }));
}

function createInitialExecution(): ExecutionStep[] {
  return executionTimeline.map((label) => ({
    label,
    status: "idle",
    detail: "Ready to simulate.",
  }));
}

function buildProductionConfig() {
  return `source:
  host: source-validator.example.com
  user: solana
  ledger_path: /mnt/ledger

destination:
  host: destination-validator.example.com
  user: solana
  ledger_path: /mnt/ledger

security:
  encryption: client-side AES-GCM
  raw_key_uploaded_to_backend: false
  passphrase_uploaded_to_backend: false

mode:
  public_demo: simulation
  production_runner: local-agent-or-ssh
`;
}

export function TransferDemo() {
  const previousEdgeCaseRef = useRef<EdgeCaseOption | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [source, setSource] = useState<ValidatorForm>({
    host: "",
    user: "",
    ledgerPath: "",
    publicKey: "",
    status: "",
  });
  const [destination, setDestination] = useState<ValidatorForm>({
    host: "",
    user: "",
    ledgerPath: "",
    publicKey: "",
    status: "",
  });
  const [edgeCase, setEdgeCase] =
    useState<EdgeCaseOption>("successful-transfer");
  const rawKeypairRef = useRef<number[] | null>(null);
  const passphraseInputRef = useRef<HTMLInputElement | null>(null);
  const [keypairError, setKeypairError] = useState("");
  const [simulatedKeypairError, setSimulatedKeypairError] = useState("");
  const [keypairSource, setKeypairSource] = useState("");
  const [hasValidKeypair, setHasValidKeypair] = useState(false);
  const [derivedPublicKey, setDerivedPublicKey] = useState("");
  const [passphraseLength, setPassphraseLength] = useState(0);
  const [encryptedPayload, setEncryptedPayload] =
    useState<EncryptedPayload | null>(null);
  const [encryptionError, setEncryptionError] = useState("");
  const [preflightChecks, setPreflightChecks] = useState(createInitialChecks);
  const [hasCompletedPreflight, setHasCompletedPreflight] = useState(false);
  const [hasConfirmedDryRunPlan, setHasConfirmedDryRunPlan] = useState(false);
  const [executionSteps, setExecutionSteps] = useState(createInitialExecution);
  const [hasExecutedTransfer, setHasExecutedTransfer] = useState(false);
  const [executionInProgress, setExecutionInProgress] = useState(false);
  const [finalMessage, setFinalMessage] = useState("");
  const [rollbackSuggestion, setRollbackSuggestion] = useState("");
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const displayKeypairError = keypairError || simulatedKeypairError;
  const blockedByInvalidKeypair =
    edgeCase === "invalid-keypair" || Boolean(displayKeypairError);
  const hasConfiguredSource = Boolean(source.host && source.user && source.ledgerPath);
  const hasConfiguredDestination = Boolean(
    destination.host && destination.user && destination.ledgerPath,
  );
  const hasEncryptedPayloadReady = Boolean(encryptedPayload);
  const invalidKeypairSelected = edgeCase === "invalid-keypair";

  const canEncrypt = Boolean(hasValidKeypair && passphraseLength >= 8);
  const canRunPreflight =
    hasConfiguredSource &&
    hasConfiguredDestination &&
    hasValidKeypair &&
    hasEncryptedPayloadReady &&
    !invalidKeypairSelected &&
    !Boolean(keypairError);
  const preflightDisabledReason = (() => {
    if (hasConfiguredSource === false) {
      return "Complete the source validator configuration before running preflight checks.";
    }

    if (hasConfiguredDestination === false) {
      return "Complete the destination validator configuration before running preflight checks.";
    }

    if (hasValidKeypair === false) {
      return "Select a valid validator keypair before running preflight checks.";
    }

    if (hasEncryptedPayloadReady === false) {
      return "Complete client-side encryption before running preflight checks.";
    }

    if (invalidKeypairSelected) {
      return "The selected edge case simulates an invalid keypair and blocks preflight.";
    }

    if (keypairError) {
      return "Resolve the keypair validation error before running preflight checks.";
    }

    return "";
  })();
  const preflightPassed =
    hasCompletedPreflight &&
    preflightChecks.every(
      (check) => check.status === "success" || check.status === "warning",
    ) &&
    preflightChecks.some((check) => check.status === "success") &&
    !preflightChecks.some((check) => check.status === "failed");
  const executionSucceeded =
    hasExecutedTransfer &&
    executionSteps.length > 0 &&
    executionSteps.every((step) => step.status === "success");
  const executionFinished =
    hasExecutedTransfer &&
    executionSteps.some(
      (step) => step.status === "success" || step.status === "failed",
    ) &&
    !executionInProgress;
  const canReachStep6 = preflightPassed;
  const canReachStep7 = preflightPassed && hasConfirmedDryRunPlan;
  const canReachStep8 = executionFinished;

  const maskedIdentity = useMemo(
    () => (derivedPublicKey ? maskPublicKey(derivedPublicKey) : "Not derived yet"),
    [derivedPublicKey],
  );

  const resetPreflightAndBeyond = () => {
    setHasCompletedPreflight(false);
    setHasConfirmedDryRunPlan(false);
    setHasExecutedTransfer(false);
    setExecutionInProgress(false);
    setPreflightChecks(createInitialChecks());
    setExecutionSteps(createInitialExecution());
    setFinalMessage("");
    setRollbackSuggestion("");
  };

  useEffect(() => {
    if (edgeCase === "invalid-keypair") {
      setSimulatedKeypairError(
        "Simulation Mode is intentionally blocking this flow because the selected edge case is Invalid keypair.",
      );
      resetPreflightAndBeyond();
    } else if (simulatedKeypairError) {
      setSimulatedKeypairError("");
      resetPreflightAndBeyond();
    }
  }, [edgeCase, simulatedKeypairError]);

  useEffect(() => {
    if (previousEdgeCaseRef.current === null) {
      previousEdgeCaseRef.current = edgeCase;
      return;
    }

    if (previousEdgeCaseRef.current !== edgeCase) {
      resetPreflightAndBeyond();
      setCurrentStep(5);
      previousEdgeCaseRef.current = edgeCase;
      return;
    }

    previousEdgeCaseRef.current = edgeCase;
  }, [edgeCase]);

  useEffect(() => {
    if (currentStep === 8 && !canReachStep8) {
      setCurrentStep(canReachStep7 ? 7 : canReachStep6 ? 6 : 5);
      return;
    }

    if (currentStep === 7 && !canReachStep7) {
      setCurrentStep(canReachStep6 ? 6 : 5);
      return;
    }

    if (currentStep === 6 && !canReachStep6) {
      setCurrentStep(5);
    }
  }, [currentStep, canReachStep6, canReachStep7, canReachStep8]);

  const updateCheck = (index: number, patch: Partial<PreflightCheck>) => {
    setPreflightChecks((current) =>
      current.map((check, currentIndex) =>
        currentIndex === index ? { ...check, ...patch } : check,
      ),
    );
  };

  const updateExecution = (index: number, patch: Partial<ExecutionStep>) => {
    setExecutionSteps((current) =>
      current.map((step, currentIndex) =>
        currentIndex === index ? { ...step, ...patch } : step,
      ),
    );
  };

  const applyDemoSource = () => {
    setSource({
      host: demoSource.host,
      user: demoSource.user,
      ledgerPath: demoSource.ledgerPath,
      publicKey: demoSource.publicKey,
      status: demoSource.status,
    });
  };

  const applyDemoDestination = () => {
    setDestination({
      host: demoDestination.host,
      user: demoDestination.user,
      ledgerPath: demoDestination.ledgerPath,
      publicKey: demoDestination.temporaryIdentity,
      status: demoDestination.syncStatus,
    });
  };

  const resetSource = () =>
    setSource({ host: "", user: "", ledgerPath: "", publicKey: "", status: "" });
  const resetDestination = () =>
    setDestination({ host: "", user: "", ledgerPath: "", publicKey: "", status: "" });

  const handleParsedKeypair = (candidate: unknown, sourceLabel: string) => {
    const error = validateKeypairArray(candidate);
    if (error) {
      rawKeypairRef.current = null;
      setHasValidKeypair(false);
      setDerivedPublicKey("");
      setEncryptedPayload(null);
      resetPreflightAndBeyond();
      setKeypairError(error);
      setKeypairSource(sourceLabel);
      return;
    }

    try {
      const bytes = candidate as number[];
      const publicKey = derivePublicKey(bytes);
      rawKeypairRef.current = bytes;
      setHasValidKeypair(true);
      setDerivedPublicKey(publicKey);
      setKeypairError("");
      setKeypairSource(sourceLabel);
      setEncryptedPayload(null);
      resetPreflightAndBeyond();
    } catch {
      rawKeypairRef.current = null;
      setHasValidKeypair(false);
      setDerivedPublicKey("");
      setEncryptedPayload(null);
      resetPreflightAndBeyond();
      setKeypairError("Keypair structure is valid JSON, but it could not be parsed as a Solana keypair.");
      setKeypairSource(sourceLabel);
    }
  };

  const handleSampleDemoKeypair = () => {
    const demoKeypair = generateDemoKeypair();

    rawKeypairRef.current = demoKeypair.secretKey;
    setHasValidKeypair(true);
    setDerivedPublicKey(demoKeypair.publicKey);
    setKeypairError("");
    setKeypairSource("Sample Demo Keypair");
    setEncryptedPayload(null);
    resetPreflightAndBeyond();
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.name.endsWith(".json")) {
      setKeypairError("Only JSON keypair files are accepted in the public demo.");
      rawKeypairRef.current = null;
      setHasValidKeypair(false);
      setDerivedPublicKey("");
      setEncryptedPayload(null);
      resetPreflightAndBeyond();
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      handleParsedKeypair(parsed, file.name);
    } catch {
      setKeypairError("The uploaded file could not be parsed as JSON.");
      rawKeypairRef.current = null;
      setHasValidKeypair(false);
      setDerivedPublicKey("");
      setEncryptedPayload(null);
      resetPreflightAndBeyond();
    }
  };

  const handleEncrypt = async () => {
    const rawKeypair = rawKeypairRef.current;
    const passphrase = passphraseInputRef.current?.value ?? "";

    if (!rawKeypair || !passphrase.trim()) {
      return;
    }

    setEncryptionError("");
    try {
      const payload = await encryptKeypair(rawKeypair, passphrase);
      setEncryptedPayload(payload);
      resetPreflightAndBeyond();
      setCurrentStep(Math.max(currentStep, 5));
    } catch {
      setEncryptedPayload(null);
      setEncryptionError("Encryption could not be completed in the browser.");
    }
  };

  const runPreflightChecks = async () => {
    setCurrentStep(5);
    resetPreflightAndBeyond();
    setPreflightChecks(createInitialChecks());

    const details: Array<{ status: CheckStatus; detail: string }> = [
      {
        status: "success",
        detail: "Source validator endpoint responded in Simulation Mode.",
      },
      {
        status: "success",
        detail: "Destination validator endpoint responded in Simulation Mode.",
      },
      edgeCase === "destination-not-synced"
        ? {
            status: "failed",
            detail:
              "Destination validator is behind and should not receive the original identity yet.",
          }
        : {
            status: "success",
            detail: "Destination validator reports synced and ready status.",
          },
      {
        status: "success",
        detail: "Expected ledger paths were detected on both simulated servers.",
      },
      edgeCase === "missing-tower-file"
        ? {
            status: "failed",
            detail:
              "Tower file is missing. Transfer is blocked until tower state is recovered or restored.",
          }
        : {
            status: "success",
            detail: "Tower file detected on the source validator.",
          },
      {
        status: "success",
        detail: "Backup location for tower state is available.",
      },
      edgeCase === "duplicate-identity-detected"
        ? {
            status: "failed",
            detail:
              "Simulation detected a duplicate active identity risk across validators.",
          }
        : {
            status: "success",
            detail: "No duplicate active identity detected in the simulated cluster state.",
          },
      blockedByInvalidKeypair
        ? {
            status: "failed",
            detail: "Encrypted identity payload is unavailable because the keypair is invalid.",
          }
        : {
            status: "success",
            detail: "Encrypted identity payload is ready for transfer orchestration.",
          },
    ];

    for (const [index, result] of details.entries()) {
      updateCheck(index, {
        status: "pending",
        detail: "Running simulated check...",
      });
      await sleep(450);
      updateCheck(index, result);
    }

    setHasCompletedPreflight(true);

    if (
      details.every(
        (check) => check.status === "success" || check.status === "warning",
      ) &&
      !details.some((check) => check.status === "failed")
    ) {
      setCurrentStep(6);
    }
  };

  const confirmDryRunPlan = () => {
    if (!preflightPassed) {
      return;
    }

    setHasConfirmedDryRunPlan(true);
    setCurrentStep(7);
  };

  const executeTransfer = async () => {
    setCurrentStep(7);
    setExecutionSteps(createInitialExecution());
    setFinalMessage("");
    setRollbackSuggestion("");
    setHasExecutedTransfer(false);
    setExecutionInProgress(true);

    for (const [index, label] of executionTimeline.entries()) {
      updateExecution(index, {
        status: "running",
        detail: "Simulating secure operator workflow...",
      });
      await sleep(500);

      if (edgeCase === "transfer-failure" && index === 3) {
        updateExecution(index, {
          status: "failed",
          detail:
            "Encrypted payload transfer stalled before destination activation. No raw key exposure occurred.",
        });
        setFinalMessage(
          "Simulated transfer stopped before completion. Operator review is required before retrying.",
        );
        setRollbackSuggestion(
          "Rollback suggestion: keep the source validator on temporary identity, verify tower backup integrity, confirm destination readiness, and retry only after re-running preflight checks.",
        );
        setHasExecutedTransfer(true);
        setExecutionInProgress(false);
        return;
      }

      updateExecution(index, {
        status: "success",
        detail:
          label === "Final verification completed"
            ? "Destination now owns the original validator identity in Simulation Mode."
            : "Completed successfully in Simulation Mode.",
      });
    }

    setFinalMessage("Transfer completed successfully.");
    setHasExecutedTransfer(true);
    setExecutionInProgress(false);
  };

  const exportConfig = () => {
    const blob = new Blob([buildProductionConfig()], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "production-transfer-config.yaml";
    link.click();
    URL.revokeObjectURL(url);
  };

  const getStepAvailability = (step: number) => {
    switch (step) {
      case 6:
        return canReachStep6;
      case 7:
        return canReachStep7;
      case 8:
        return canReachStep8;
      default:
        return true;
    }
  };

  const getNextStep = () => {
    const candidate = Math.min(8, currentStep + 1);

    if (candidate === 6 && !canReachStep6) {
      return currentStep;
    }

    if (candidate === 7 && !canReachStep7) {
      return currentStep;
    }

    if (candidate === 8 && !canReachStep8) {
      return currentStep;
    }

    return candidate;
  };

  const isNextDisabled = (() => {
    if (currentStep === 8) {
      return true;
    }

    if (currentStep === 5) {
      return !canReachStep6;
    }

    if (currentStep === 6) {
      return !canReachStep7;
    }

    if (currentStep === 7) {
      return !canReachStep8;
    }

    return false;
  })();

  const moveToStep = (step: number) => {
    if (step > currentStep && !getStepAvailability(step)) {
      return;
    }

    startTransition(() => {
      setCurrentStep(step);
    });
  };

  const showSuccessState = Boolean(finalMessage) && !rollbackSuggestion;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
      <section className="panel overflow-hidden">
        <div className="grid gap-10 px-8 py-10 lg:grid-cols-[1.2fr_0.8fr] lg:px-10">
          <div className="space-y-6">
            <span className="status-pill bg-amber-100 text-amber-800">
              Public demo runs in Simulation Mode for safety.
            </span>
            <div className="space-y-4">
              <p className="section-title">Solana Validator Operations</p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
                Solana Validator Identity Transfer Tool
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                Securely move your Solana validator identity between servers with
                a simulation-first workflow for encryption, preflight checks,
                transfer orchestration, and operator verification.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="button-primary" onClick={() => moveToStep(1)}>
                Start Demo Transfer
              </button>
              <a className="button-secondary" href="#security-model">
                View Security Model
              </a>
            </div>
          </div>
          <div className="panel border-slate-200 bg-slate-950 text-white">
            <div className="space-y-5 px-6 py-6">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-300">
                Operator Flow
              </p>
              <div className="space-y-3">
                {[
                  "Configure source and destination validators",
                  "Validate a demo validator identity keypair locally",
                  "Encrypt the keypair in the browser with PBKDF2 + AES-GCM",
                  "Run simulated safety checks and dry-run planning",
                  "Execute the transfer timeline and review final state",
                ].map((item, index) => (
                  <div
                    key={item}
                    className="animate-rise rounded-2xl border border-white/10 bg-white/5 p-4"
                    style={{ animationDelay: `${index * 0.08}s` }}
                  >
                    <p className="text-sm leading-6 text-slate-200">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-8 xl:grid-cols-[280px_1fr]">
        <aside className="panel h-fit p-5">
          <div className="space-y-5">
            <div>
              <p className="section-title">Transfer Wizard</p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">
                End-to-end demo flow
              </h2>
            </div>
            <div className="space-y-3">
              {stepTitles.map((title, index) => {
                const step = index + 1;
                const isActive = currentStep === step;
                const isComplete = currentStep > step;

                return (
                  <button
                    key={title}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                      !getStepAvailability(step) && step > currentStep
                        ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                        : isActive
                          ? "border-ink bg-slate-950 text-white"
                          : isComplete
                            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                    disabled={!getStepAvailability(step) && step > currentStep}
                    onClick={() => moveToStep(step)}
                    type="button"
                  >
                    <span
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                        !getStepAvailability(step) && step > currentStep
                          ? "bg-slate-200 text-slate-500"
                          : isActive
                            ? "bg-white text-slate-950"
                            : isComplete
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {step}
                    </span>
                    <span className="text-sm font-semibold">{title}</span>
                  </button>
                );
              })}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Edge Case Simulator
              </p>
              <select
                className="field-input mt-3"
                value={edgeCase}
                onChange={(event) => setEdgeCase(event.target.value as EdgeCaseOption)}
              >
                {Object.entries(edgeCaseLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {edgeCaseDescriptions[edgeCase]}
              </p>
            </div>
            <button className="button-secondary w-full" onClick={exportConfig}>
              Export Production Config
            </button>
          </div>
        </aside>

        <div className="space-y-8">
          <section className="panel p-7">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="section-title">Current Step</p>
                <h2 className="mt-2 text-3xl font-semibold text-slate-950">
                  Step {currentStep} - {stepTitles[currentStep - 1]}
                </h2>
              </div>
              {isPending ? (
                <span className="status-pill bg-sky-100 text-sky-700">
                  Updating step
                </span>
              ) : null}
            </div>

            <div className="mt-8 space-y-10">
              <div className={currentStep === 1 ? "block" : "hidden"}>
                <ValidatorSection
                  title="Source Validator"
                  description="Capture the currently active validator identity and ledger context for the source machine."
                  form={source}
                  onChange={setSource}
                  actionLabel="Use demo source validator"
                  onAction={applyDemoSource}
                  onReset={resetSource}
                  statusHint="Demo status: Active / Voting"
                />
              </div>

              <div className={currentStep === 2 ? "block" : "hidden"}>
                <ValidatorSection
                  title="Destination Validator"
                  description="Prepare the destination machine that will receive the original validator identity after verification."
                  form={destination}
                  onChange={setDestination}
                  actionLabel="Use demo destination validator"
                  onAction={applyDemoDestination}
                  onReset={resetDestination}
                  statusHint="Demo status: Synced / Ready"
                />
              </div>

              <div className={currentStep === 3 ? "block" : "hidden"}>
                <div className="space-y-5">
                  <div>
                    <p className="section-title">Identity Key</p>
                    <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                      Validate the validator keypair locally
                    </h3>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                      Upload `validator-keypair.json` or use the built-in sample.
                      The public demo validates structure client-side and never
                      displays the raw private key.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      className="button-primary"
                      onClick={() => fileInputRef.current?.click()}
                      type="button"
                    >
                      Upload validator-keypair.json
                    </button>
                    <button
                      className="button-secondary"
                      onClick={handleSampleDemoKeypair}
                      type="button"
                    >
                      Use Sample Demo Keypair
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    className="hidden"
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileUpload}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <InfoCard
                      label="Selected source"
                      value={keypairSource || "No keypair selected"}
                    />
                    <InfoCard
                      label="Derived public identity"
                      value={derivedPublicKey ? maskedIdentity : "Waiting for valid keypair"}
                    />
                  </div>

                  {displayKeypairError ? (
                    <MessagePanel tone="danger" title="Keypair validation failed">
                      {displayKeypairError}
                    </MessagePanel>
                  ) : hasValidKeypair ? (
                    <MessagePanel tone="success" title="Keypair parsed locally">
                      The keypair is valid, stayed in browser memory only, and is
                      ready for encryption.
                    </MessagePanel>
                  ) : (
                    <MessagePanel tone="info" title="Demo safety note">
                      This public demo is designed for sample data and simulation.
                      Do not upload a real mainnet validator identity to a public
                      bounty deployment.
                    </MessagePanel>
                  )}
                </div>
              </div>

              <div className={currentStep === 4 ? "block" : "hidden"}>
                <div className="space-y-5">
                  <div>
                    <p className="section-title">Client-side Encryption</p>
                    <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                      Encrypt the key in the browser
                    </h3>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                      PBKDF2 derives the key from the passphrase. AES-GCM encrypts
                      the payload with a random salt and IV. Raw key material and
                      passphrase never leave the browser.
                    </p>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      Passphrase
                    </span>
                    <input
                      ref={passphraseInputRef}
                      className="field-input"
                      type="password"
                      placeholder="Enter a local passphrase"
                      onChange={(event) => setPassphraseLength(event.target.value.length)}
                    />
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <button
                      className="button-primary"
                      disabled={!canEncrypt || blockedByInvalidKeypair}
                      onClick={handleEncrypt}
                      type="button"
                    >
                      Encrypt in Browser
                    </button>
                    <button
                      className="button-secondary"
                      onClick={() => moveToStep(3)}
                      type="button"
                    >
                      Review keypair
                    </button>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <MessagePanel tone="success" title="Local-only handling">
                      Keypair parsed locally, public identity derived in browser,
                      and raw key never sent to backend.
                    </MessagePanel>
                    <MessagePanel tone="info" title="Masked public identity">
                      {derivedPublicKey
                        ? `Derived identity: ${maskedIdentity}`
                        : "A valid keypair is required before public identity can be derived."}
                    </MessagePanel>
                  </div>

                  {encryptionError ? (
                    <MessagePanel tone="danger" title="Encryption error">
                      {encryptionError}
                    </MessagePanel>
                  ) : null}

                  {encryptedPayload ? (
                    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                      <p className="text-sm font-semibold text-emerald-800">
                        Encrypted payload ready
                      </p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <InfoCard label="Algorithm" value={encryptedPayload.algorithm} />
                        <InfoCard label="KDF" value={encryptedPayload.kdf} />
                        <InfoCard
                          label="Iterations"
                          value={String(encryptedPayload.iterations)}
                        />
                        <InfoCard
                          label="Ciphertext preview"
                          value={`${encryptedPayload.ciphertext.slice(0, 18)}...`}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className={currentStep === 5 ? "block" : "hidden"}>
                <div className="space-y-5">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="section-title">Preflight Checks</p>
                      <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                        Validate safety conditions before transfer
                      </h3>
                    </div>
                    <button
                      className="button-primary"
                      disabled={!canRunPreflight}
                      onClick={runPreflightChecks}
                      type="button"
                    >
                      Run Preflight Checks
                    </button>
                  </div>

                  <div className="space-y-3">
                    {preflightChecks.map((check) => (
                      <StatusRow
                        key={check.name}
                        title={check.name}
                        detail={check.detail}
                        status={check.status}
                      />
                    ))}
                  </div>

                  {!canRunPreflight ? (
                    <MessagePanel tone="info" title="Preflight is not ready yet">
                      {preflightDisabledReason}
                    </MessagePanel>
                  ) : null}

                  {hasCompletedPreflight && !preflightPassed ? (
                    <MessagePanel tone="danger" title="Preflight blocked the transfer">
                      Review the failed simulated checks before continuing. Dry run
                      planning stays locked until preflight passes.
                    </MessagePanel>
                  ) : null}
                </div>
              </div>

              <div className={currentStep === 6 ? "block" : "hidden"}>
                <div className="space-y-5">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="section-title">Dry Run Plan</p>
                      <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                        Review the transfer sequence before execution
                      </h3>
                    </div>
                    <button
                      className="button-primary"
                      disabled={!preflightPassed}
                      onClick={confirmDryRunPlan}
                      type="button"
                    >
                      Confirm Dry Run Plan
                    </button>
                  </div>

                  <div className="space-y-3">
                    {dryRunPlan.map((item, index) => (
                      <div
                        key={item}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                      >
                        <p className="text-sm font-semibold text-slate-900">
                          {index + 1}. {item}
                        </p>
                      </div>
                    ))}
                  </div>

                  {hasConfirmedDryRunPlan ? (
                    <MessagePanel tone="success" title="Dry run plan confirmed">
                      The execution step is now unlocked. Continue to Step 7 to run
                      the simulated transfer timeline.
                    </MessagePanel>
                  ) : null}
                </div>
              </div>

              <div className={currentStep === 7 ? "block" : "hidden"}>
                <div className="space-y-5">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="section-title">Transfer Execution</p>
                      <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                        Simulated transfer timeline
                      </h3>
                    </div>
                    <button
                      className="button-primary"
                      disabled={!canReachStep7 || executionInProgress}
                      onClick={executeTransfer}
                      type="button"
                    >
                      Execute Simulated Transfer
                    </button>
                  </div>
                  <div className="space-y-3">
                    {executionSteps.map((step) => (
                      <StatusRow
                        key={step.label}
                        title={step.label}
                        detail={step.detail}
                        status={step.status}
                      />
                    ))}
                  </div>

                  {!hasExecutedTransfer ? (
                    <MessagePanel tone="info" title="Execution required">
                      Run the simulated transfer timeline to unlock the final result
                      step.
                    </MessagePanel>
                  ) : rollbackSuggestion ? (
                    <MessagePanel tone="danger" title="Execution ended with failure">
                      One execution step failed in Simulation Mode. Proceed to the
                      final result step to review rollback guidance.
                    </MessagePanel>
                  ) : executionSucceeded ? (
                    <MessagePanel tone="success" title="Execution completed">
                      All simulated execution steps completed successfully. The
                      final operator report is ready.
                    </MessagePanel>
                  ) : null}
                </div>
              </div>

              <div className={currentStep === 8 ? "block" : "hidden"}>
                <div className="space-y-5">
                  <div>
                    <p className="section-title">Final Result</p>
                    <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                      Transfer outcome
                    </h3>
                  </div>

                  {finalMessage ? (
                    <MessagePanel
                      tone={rollbackSuggestion ? "danger" : "success"}
                      title={rollbackSuggestion ? "Transfer interrupted" : "Transfer completed"}
                    >
                      {finalMessage}
                    </MessagePanel>
                  ) : (
                    <MessagePanel tone="info" title="Awaiting simulated execution">
                      Run the transfer timeline to produce the final operator report.
                    </MessagePanel>
                  )}

                  {showSuccessState ? (
                    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                      <InfoCard
                        label="Source Validator"
                        value={`${successResult.sourceIdentity} / ${successResult.sourceStatus}`}
                        valueClassName="break-words"
                      />
                      <InfoCard
                        label="Destination Validator"
                        value={`${successResult.destinationIdentity} / ${successResult.destinationStatus}`}
                        valueClassName="break-words"
                      />
                      <InfoCard
                        label="Security"
                        value="Raw key never sent to backend. Encrypted payload only. Passphrase stayed local."
                        valueClassName="break-words"
                      />
                    </div>
                  ) : null}

                  {rollbackSuggestion ? (
                    <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
                      <p className="text-sm font-semibold text-rose-800">
                        Operator rollback guidance
                      </p>
                      <p className="mt-3 text-sm leading-6 text-rose-700">
                        {rollbackSuggestion}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                className="button-secondary"
                disabled={currentStep === 1}
                onClick={() => moveToStep(Math.max(1, currentStep - 1))}
                type="button"
              >
                Back
              </button>
              <button
                className="button-primary"
                disabled={isNextDisabled}
                onClick={() => moveToStep(getNextStep())}
                type="button"
              >
                Next
              </button>
            </div>
          </section>

          <section id="security-model" className="grid gap-8 lg:grid-cols-2">
            <div className="panel p-7">
              <p className="section-title">Security Model</p>
              <h2 className="mt-3 text-3xl font-semibold text-slate-950">
                Browser-first protection for sensitive key material
              </h2>
              <div className="mt-6 space-y-3 text-sm leading-7 text-slate-600">
                <p>Raw validator identity key is never sent to the backend.</p>
                <p>Encryption happens in the browser using Web Crypto API.</p>
                <p>The passphrase never leaves the browser.</p>
                <p>The public demo uses simulated validators for safety.</p>
                <p>
                  Production usage should be executed through an
                  operator-controlled local agent or SSH runner.
                </p>
                <p>
                  The tool is designed to reduce accidental key exposure and
                  guide operators through safer transfer steps.
                </p>
              </div>
            </div>

            <div className="panel p-7">
              <p className="section-title">Production Architecture</p>
              <h2 className="mt-3 text-3xl font-semibold text-slate-950">
                Public demo and production boundaries
              </h2>
              <div className="mt-6 space-y-4">
                {[
                  "Browser UI",
                  "Client-side encryption",
                  "Encrypted payload",
                  "Local agent / SSH runner controlled by validator operator",
                  "Source validator + destination validator",
                ].map((layer, index) => (
                  <div key={layer} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {index + 1}. {layer}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-sm leading-7 text-slate-600">
                The public demo intentionally does not request real SSH keys or
                real validator private keys. For production usage, the transfer
                runner should execute inside operator-controlled infrastructure.
              </p>
            </div>
          </section>

          <section className="panel p-7">
            <p className="section-title">Edge Cases</p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950">
              Built-in simulation scenarios
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[
                "invalid keypair file",
                "destination validator not synced",
                "missing tower file",
                "duplicate active identity",
                "transfer interruption",
                "failed final verification",
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">{item}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function ValidatorSection({
  title,
  description,
  form,
  onChange,
  actionLabel,
  onAction,
  onReset,
  statusHint,
}: {
  title: string;
  description: string;
  form: ValidatorForm;
  onChange: (value: ValidatorForm) => void;
  actionLabel: string;
  onAction: () => void;
  onReset: () => void;
  statusHint: string;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="section-title">{title}</p>
        <h3 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h3>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          {description}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label={`${title === "Source Validator" ? "Source" : "Destination"} Host`}
          value={form.host}
          onChange={(value) => onChange({ ...form, host: value })}
        />
        <Field
          label="SSH User"
          value={form.user}
          onChange={(value) => onChange({ ...form, user: value })}
        />
        <Field
          label="Ledger Path"
          value={form.ledgerPath}
          onChange={(value) => onChange({ ...form, ledgerPath: value })}
        />
        <Field
          label={
            title === "Source Validator"
              ? "Current Identity Public Key"
              : "Current Temporary Identity Public Key"
          }
          value={form.publicKey}
          onChange={(value) => onChange({ ...form, publicKey: value })}
        />
        <div className="md:col-span-2">
          <Field
            label={title === "Source Validator" ? "Validator Status" : "Sync Status"}
            value={form.status}
            onChange={(value) => onChange({ ...form, status: value })}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button className="button-primary" onClick={onAction} type="button">
          {actionLabel}
        </button>
        <button className="button-secondary" onClick={onReset} type="button">
          Reset
        </button>
      </div>

      <MessagePanel tone="info" title="Demo Mode hint">
        {statusHint}
      </MessagePanel>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <input
        className="field-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function StatusRow({
  title,
  detail,
  status,
}: {
  title: string;
  detail: string;
  status: CheckStatus;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <span className={statusClasses(status)}>{status}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </div>
  );
}

function InfoCard({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p
        className={`mt-3 text-sm font-medium leading-6 text-slate-900 ${valueClassName ?? "break-words"}`}
      >
        {value}
      </p>
    </div>
  );
}

function MessagePanel({
  title,
  children,
  tone,
}: {
  title: string;
  children: React.ReactNode;
  tone: "success" | "danger" | "info";
}) {
  const classes =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "danger"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-sky-200 bg-sky-50 text-sky-800";

  return (
    <div className={`rounded-3xl border p-5 ${classes}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-3 text-sm leading-6">{children}</p>
    </div>
  );
}
