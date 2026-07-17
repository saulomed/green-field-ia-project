import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { MailService } from './mail.service';

describe('MailService', () => {
  let service: MailService;
  let mailerService: jest.Mocked<MailerService>;

  const APP_BASE_URL = 'https://streamtube.test';

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: MailerService,
          useValue: { sendMail: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue({ appBaseUrl: APP_BASE_URL }),
          },
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    mailerService = module.get(MailerService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendConfirmation', () => {
    it('should call sendMail with the confirm-account template', async () => {
      await service.sendConfirmation('user@example.com', 'Alice', 'jwt-token-123');

      expect(mailerService.sendMail).toHaveBeenCalledTimes(1);
      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          template: 'confirm-account',
        }),
      );
    });

    it('should pass the correct context with name and link containing the token', async () => {
      await service.sendConfirmation('user@example.com', 'Alice', 'jwt-token-123');

      const call = mailerService.sendMail.mock.calls[0][0];
      expect(call.context.name).toBe('Alice');
      expect(call.context.link).toContain('jwt-token-123');
      expect(call.context.link).toContain(APP_BASE_URL);
      expect(call.context.link).toContain('/confirm-account?token=');
      expect(call.context.link).not.toContain('/auth/confirm');
    });
  });

  describe('sendPasswordReset', () => {
    it('should call sendMail with the reset-password template', async () => {
      await service.sendPasswordReset('user@example.com', 'Bob', 'reset-token-456');

      expect(mailerService.sendMail).toHaveBeenCalledTimes(1);
      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          template: 'reset-password',
        }),
      );
    });

    it('should pass the correct context with name and link containing the token', async () => {
      await service.sendPasswordReset('user@example.com', 'Bob', 'reset-token-456');

      const call = mailerService.sendMail.mock.calls[0][0];
      expect(call.context.name).toBe('Bob');
      expect(call.context.link).toContain('reset-token-456');
      expect(call.context.link).toContain(APP_BASE_URL);
      expect(call.context.link).toContain('/reset-password?token=');
      expect(call.context.link).not.toContain('/auth/reset-password');
    });
  });
});
