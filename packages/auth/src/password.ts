import { z } from "zod"

/*
 * The one password policy, shared by the server hook that enforces it and the
 * forms that explain it. Keep this file free of server imports: the web app
 * pulls it into client bundles.
 */

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

/** Exported so forms can rebuild the schema with translated messages. */
export const UPPERCASE_PATTERN = /[A-Z]/
export const SPECIAL_CHARACTER_PATTERN = /[^A-Za-z0-9\s]/

const UPPERCASE_RULE = {
  pattern: UPPERCASE_PATTERN,
  message: "Password must contain at least one uppercase letter",
}

const SPECIAL_CHARACTER_RULE = {
  pattern: SPECIAL_CHARACTER_PATTERN,
  message: "Password must contain at least one special character",
}

/**
 * First character rule the password breaks, or null. Length is not checked
 * here: Better Auth already enforces the min/max it is configured with.
 */
export function findPasswordViolation(password: string): string | null {
  for (const rule of [UPPERCASE_RULE, SPECIAL_CHARACTER_RULE]) {
    if (!rule.pattern.test(password)) {
      return rule.message
    }
  }

  return null
}

/** Schema for any field where the user chooses a new password. */
export const newPasswordSchema = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
  )
  .max(
    PASSWORD_MAX_LENGTH,
    `Password must be at most ${PASSWORD_MAX_LENGTH} characters`
  )
  .regex(UPPERCASE_RULE.pattern, UPPERCASE_RULE.message)
  .regex(SPECIAL_CHARACTER_RULE.pattern, SPECIAL_CHARACTER_RULE.message)
