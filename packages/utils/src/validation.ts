export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPhone(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(phone);
}

export function isValidGst(gst: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gst);
}

export function isValidPincode(pincode: string): boolean {
  return /^[1-9][0-9]{5}$/.test(pincode);
}

export function isStrongPassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 8) errors.push('At least 8 characters required');
  if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter required');
  if (!/[a-z]/.test(password)) errors.push('At least one lowercase letter required');
  if (!/[0-9]/.test(password)) errors.push('At least one number required');
  if (!/[!@#$%^&*]/.test(password)) errors.push('At least one special character required');
  return { valid: errors.length === 0, errors };
}
