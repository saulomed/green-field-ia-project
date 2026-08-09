import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  PORT: Joi.number().port().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  MAIL_HOST: Joi.string().required(),
  MAIL_PORT: Joi.number().port().required(),
  MAIL_USER: Joi.string(),
  MAIL_PASS: Joi.string(),
  MAIL_FROM: Joi.string(),
  APP_BASE_URL: Joi.string().uri(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('15m'),
  JWT_REFRESH_TTL: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('7d'),
  CONFIRM_TOKEN_TTL: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('24h'),
  RESET_TOKEN_TTL: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('1h'),
  COOKIE_SECURE: Joi.boolean().default(false),
  COOKIE_SAMESITE: Joi.string()
    .valid('strict', 'lax', 'none')
    .default('strict'),
  SWAGGER_ENABLED: Joi.boolean(),
  SWAGGER_PATH: Joi.string().default('api/docs'),
});
