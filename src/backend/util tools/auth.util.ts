import * as crypto from "crypto";

/**
 * Creates a hashed password and salt
 * Use this when creating a new user or changing password
 */
export function createPasswordHash(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");

  return {
    hashedPassword: hash,
    salt: salt,
  };
}

/**
 * Verifies a password against stored hash and salt
 * Use this during login
 */
export function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string
): boolean {
  const hash = crypto
    .pbkdf2Sync(password, storedSalt, 100000, 64, "sha512")
    .toString("hex");
  return hash === storedHash;
}
