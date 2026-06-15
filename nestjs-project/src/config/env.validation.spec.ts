import { envValidationSchema } from './env.validation';

const baseEnv = {
  DB_HOST: 'db',
  DB_PORT: 5432,
  DB_USER: 'streamtube',
  DB_PASSWORD: 'streamtube',
  DB_NAME: 'streamtube',
  MAIL_HOST: 'mailpit',
  MAIL_PORT: 1025,
};

describe('envValidationSchema', () => {
  describe('defaults', () => {
    it('should apply PORT=3000 when PORT is absent', () => {
      const { value } = envValidationSchema.validate(baseEnv, { allowUnknown: true });
      expect(value.PORT).toBe(3000);
    });

    it('should apply NODE_ENV=development when NODE_ENV is absent', () => {
      const { value } = envValidationSchema.validate(baseEnv, { allowUnknown: true });
      expect(value.NODE_ENV).toBe('development');
    });
  });

  describe('required database variables', () => {
    it('should fail when DB_HOST is absent', () => {
      const { error } = envValidationSchema.validate(
        { ...baseEnv, DB_HOST: undefined },
        { allowUnknown: true },
      );
      expect(error).toBeDefined();
      expect(error?.message).toContain('DB_HOST');
    });

    it('should fail when DB_USER is absent', () => {
      const { error } = envValidationSchema.validate(
        { ...baseEnv, DB_USER: undefined },
        { allowUnknown: true },
      );
      expect(error).toBeDefined();
      expect(error?.message).toContain('DB_USER');
    });

    it('should fail when DB_NAME is absent', () => {
      const { error } = envValidationSchema.validate(
        { ...baseEnv, DB_NAME: undefined },
        { allowUnknown: true },
      );
      expect(error).toBeDefined();
      expect(error?.message).toContain('DB_NAME');
    });
  });

  describe('required mail variables', () => {
    it('should fail when MAIL_HOST is absent', () => {
      const { error } = envValidationSchema.validate(
        { ...baseEnv, MAIL_HOST: undefined },
        { allowUnknown: true },
      );
      expect(error).toBeDefined();
      expect(error?.message).toContain('MAIL_HOST');
    });

    it('should fail when MAIL_PORT is absent', () => {
      const { error } = envValidationSchema.validate(
        { ...baseEnv, MAIL_PORT: undefined },
        { allowUnknown: true },
      );
      expect(error).toBeDefined();
      expect(error?.message).toContain('MAIL_PORT');
    });
  });

  describe('NODE_ENV allowed values', () => {
    it('should accept production as NODE_ENV', () => {
      const { error } = envValidationSchema.validate(
        { ...baseEnv, NODE_ENV: 'production' },
        { allowUnknown: true },
      );
      expect(error).toBeUndefined();
    });

    it('should reject an invalid NODE_ENV value', () => {
      const { error } = envValidationSchema.validate(
        { ...baseEnv, NODE_ENV: 'staging' },
        { allowUnknown: true },
      );
      expect(error).toBeDefined();
      expect(error?.message).toContain('NODE_ENV');
    });
  });
});
