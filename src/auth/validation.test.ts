import {
  validateEmail,
  validatePassword,
  validateName,
  validateLoginForm,
  validateRegisterForm,
  hasErrors,
} from './validation';

describe('validateEmail', () => {
  it('returns error for empty email', () => {
    expect(validateEmail('')).toBe('El correo es requerido.');
    expect(validateEmail('   ')).toBe('El correo es requerido.');
  });

  it('returns error for invalid format', () => {
    expect(validateEmail('invalid')).toBe('Formato de correo invalido.');
    expect(validateEmail('test@')).toBe('Formato de correo invalido.');
    expect(validateEmail('@test.com')).toBe('Formato de correo invalido.');
  });

  it('returns undefined for valid email', () => {
    expect(validateEmail('test@example.com')).toBeUndefined();
    expect(validateEmail('user@campo.sv')).toBeUndefined();
  });
});

describe('validatePassword', () => {
  it('returns error for empty password', () => {
    expect(validatePassword('')).toBe('La contraseña es requerida.');
  });

  it('returns error for short password', () => {
    expect(validatePassword('12345')).toBe(
      'La contraseña debe tener al menos 6 caracteres.'
    );
  });

  it('returns undefined for valid password', () => {
    expect(validatePassword('123456')).toBeUndefined();
    expect(validatePassword('securePass!')).toBeUndefined();
  });
});

describe('validateName', () => {
  it('returns error for empty name', () => {
    expect(validateName('')).toBe('El nombre es requerido.');
  });

  it('returns error for single character', () => {
    expect(validateName('A')).toBe('El nombre debe tener al menos 2 caracteres.');
  });

  it('returns undefined for valid name', () => {
    expect(validateName('Juan Perez')).toBeUndefined();
  });
});

describe('validateLoginForm', () => {
  it('returns errors for empty fields', () => {
    const errors = validateLoginForm('', '');
    expect(errors.email).toBeDefined();
    expect(errors.password).toBeDefined();
    expect(hasErrors(errors)).toBe(true);
  });

  it('returns no errors for valid input', () => {
    const errors = validateLoginForm('test@test.com', '123456');
    expect(hasErrors(errors)).toBe(false);
  });
});

describe('validateRegisterForm', () => {
  it('returns error when passwords do not match', () => {
    const errors = validateRegisterForm('Juan', 'test@test.com', '123456', '654321');
    expect(errors.confirmPassword).toBe('Las contraseñas no coinciden.');
  });

  it('returns error when confirm password is empty', () => {
    const errors = validateRegisterForm('Juan', 'test@test.com', '123456', '');
    expect(errors.confirmPassword).toBe('Confirme su contraseña.');
  });

  it('returns no errors for valid input', () => {
    const errors = validateRegisterForm('Juan Perez', 'test@test.com', '123456', '123456');
    expect(hasErrors(errors)).toBe(false);
  });
});
