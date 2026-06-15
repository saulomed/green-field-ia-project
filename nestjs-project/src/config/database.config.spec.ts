import { buildDatabaseOptions } from './database.config';

const baseEnv: NodeJS.ProcessEnv = {
  DB_HOST: 'db',
  DB_PORT: '5432',
  DB_USER: 'streamtube',
  DB_PASSWORD: 'streamtube',
  DB_NAME: 'streamtube',
};

describe('buildDatabaseOptions', () => {
  it('should set type to postgres', () => {
    const options = buildDatabaseOptions(baseEnv);
    expect(options.type).toBe('postgres');
  });

  it('should map DB_HOST to host', () => {
    const options = buildDatabaseOptions(baseEnv);
    expect(options.host).toBe('db');
  });

  it('should convert DB_PORT string to number', () => {
    const options = buildDatabaseOptions(baseEnv);
    expect(typeof options.port).toBe('number');
    expect(options.port).toBe(5432);
  });

  it('should map DB_USER to username', () => {
    const options = buildDatabaseOptions(baseEnv);
    expect(options.username).toBe('streamtube');
  });

  it('should have synchronize disabled', () => {
    const options = buildDatabaseOptions(baseEnv);
    expect(options.synchronize).toBe(false);
  });

  it('should use the service name as host, never localhost', () => {
    const options = buildDatabaseOptions({ ...baseEnv, DB_HOST: 'db' });
    expect(options.host).toBe('db');
    expect(options.host).not.toBe('localhost');
    expect(options.host).not.toBe('127.0.0.1');
  });
});
