export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface MoveValidationResult {
  isValid: boolean;
  error?: string;
}
