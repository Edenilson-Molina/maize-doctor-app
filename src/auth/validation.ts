const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

export interface ValidationErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export function validateEmail(email: string): string | undefined {
  if (!email.trim()) return 'El correo es requerido.';
  if (!EMAIL_REGEX.test(email.trim())) return 'Formato de correo invalido.';
  return undefined;
}

export function validatePassword(password: string): string | undefined {
  if (!password) return 'La contraseña es requerida.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  return undefined;
}

export function validateName(name: string): string | undefined {
  if (!name.trim()) return 'El nombre es requerido.';
  if (name.trim().length < 2) return 'El nombre debe tener al menos 2 caracteres.';
  return undefined;
}

export function validateLoginForm(email: string, password: string): ValidationErrors {
  return {
    email: validateEmail(email),
    password: validatePassword(password),
  };
}

export function validateRegisterForm(
  name: string,
  email: string,
  password: string,
  confirmPassword: string
): ValidationErrors {
  const errors: ValidationErrors = {
    name: validateName(name),
    email: validateEmail(email),
    password: validatePassword(password),
  };

  if (!confirmPassword) {
    errors.confirmPassword = 'Confirme su contraseña.';
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Las contraseñas no coinciden.';
  }

  return errors;
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.values(errors).some((e) => e !== undefined);
}
