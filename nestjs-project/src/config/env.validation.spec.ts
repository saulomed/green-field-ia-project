import { envValidationSchema } from './env.validation';

const baseEnv = {
  DB_HOST: 'db',
  DB_PORT: 5432,
  DB_USER: 'streamtube',
  DB_PASSWORD: 'streamtube',
  DB_NAME: 'streamtube',
  MAIL_HOST: 'mailpit',
  MAIL_PORT: 1025,
  JWT_SECRET: 'super-secret-value-that-is-at-least-32-chars',
};

describe('envValidationSchema', () => {
  describe('defaults', () => {
    it('should apply PORT=3000 when PORT is absent', () => {
      const { value } = envValidationSchema.validate(baseEnv, {
        allowUnknown: true,
      });
      expect(value.PORT).toBe(3000);
    });

    it('should apply NODE_ENV=development when NODE_ENV is absent', () => {
      const { value } = envValidationSchema.validate(baseEnv, {
        allowUnknown: true,
      });
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

  describe('JWT_SECRET', () => {
    it('should fail when JWT_SECRET is absent', () => {
      const { error } = envValidationSchema.validate(
        { ...baseEnv, JWT_SECRET: undefined },
        { allowUnknown: true },
      );
      expect(error).toBeDefined();
      expect(error?.message).toContain('JWT_SECRET');
    });

    it('should fail when JWT_SECRET is shorter than 32 characters', () => {
      const { error } = envValidationSchema.validate(
        { ...baseEnv, JWT_SECRET: 'short' },
        { allowUnknown: true },
      );
      expect(error).toBeDefined();
      expect(error?.message).toContain('JWT_SECRET');
    });
  });

  describe('JWT TTL defaults', () => {
    it('should apply JWT_ACCESS_TTL=15m when absent', () => {
      const { value } = envValidationSchema.validate(baseEnv, {
        allowUnknown: true,
      });
      expect(value.JWT_ACCESS_TTL).toBe('15m');
    });

    it('should apply JWT_REFRESH_TTL=7d when absent', () => {
      const { value } = envValidationSchema.validate(baseEnv, {
        allowUnknown: true,
      });
      expect(value.JWT_REFRESH_TTL).toBe('7d');
    });

    it('should apply CONFIRM_TOKEN_TTL=24h when absent', () => {
      const { value } = envValidationSchema.validate(baseEnv, {
        allowUnknown: true,
      });
      expect(value.CONFIRM_TOKEN_TTL).toBe('24h');
    });

    it('should apply RESET_TOKEN_TTL=1h when absent', () => {
      const { value } = envValidationSchema.validate(baseEnv, {
        allowUnknown: true,
      });
      expect(value.RESET_TOKEN_TTL).toBe('1h');
    });

    it('should accept explicit JWT_ACCESS_TTL value', () => {
      const { error, value } = envValidationSchema.validate(
        { ...baseEnv, JWT_ACCESS_TTL: '30m' },
        { allowUnknown: true },
      );
      expect(error).toBeUndefined();
      expect(value.JWT_ACCESS_TTL).toBe('30m');
    });
  });

  describe('cookie defaults', () => {
    it('should apply COOKIE_SECURE=false when absent', () => {
      const { value } = envValidationSchema.validate(baseEnv, {
        allowUnknown: true,
      });
      expect(value.COOKIE_SECURE).toBe(false);
    });

    it('should apply COOKIE_SAMESITE=strict when absent', () => {
      const { value } = envValidationSchema.validate(baseEnv, {
        allowUnknown: true,
      });
      expect(value.COOKIE_SAMESITE).toBe('strict');
    });

    it('should reject invalid COOKIE_SAMESITE value', () => {
      const { error } = envValidationSchema.validate(
        { ...baseEnv, COOKIE_SAMESITE: 'invalid' },
        { allowUnknown: true },
      );
      expect(error).toBeDefined();
      expect(error?.message).toContain('COOKIE_SAMESITE');
    });
  });

  describe('SWAGGER_PATH', () => {
    it('should apply SWAGGER_PATH=api/docs when absent', () => {
      const { value } = envValidationSchema.validate(baseEnv, {
        allowUnknown: true,
      });
      expect(value.SWAGGER_PATH).toBe('api/docs');
    });
  });

  describe('SWAGGER_ENABLED', () => {
    it('should reject a non-boolean SWAGGER_ENABLED value', () => {
      const { error } = envValidationSchema.validate(
        { ...baseEnv, SWAGGER_ENABLED: 'nao-booleano' },
        { allowUnknown: true },
      );
      expect(error).toBeDefined();
      expect(error?.message).toContain('SWAGGER_ENABLED');
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
