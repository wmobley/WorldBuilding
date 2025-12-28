export type Tag = {
  namespace: string;
  value: string;
};

export type TagValidationIssue = {
  severity: "error" | "warn";
  code: string;
  message: string;
  tag: string;
};
