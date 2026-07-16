export type WorkType = "code" | "creative";

export type VerificationRequest = {
  workType: WorkType;
  artifactUrl: string;
  baselineUrl?: string;
};
