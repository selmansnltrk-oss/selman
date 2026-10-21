import { it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { loadConfig, ConfigurationError } from '../server/src/config';

const valid = () => ({
  NODE_ENV: 'production', HOST: '0.0.0.0',
  WIX_CLIENT_ID: '7b23a54e-e11b-4d43-b738-e5704e8723e6',
  WIX_SITE_ID: 'ece5420a-0b61-4879-8872-0e899f7628b5',
  SERVER_DATA_KEY: randomBytes(32).toString('base64'),
  RENDER_EXTERNAL_URL: 'https://render-test.example', DATABASE_PATH: ':memory:',
});
it('reports invalid fields without echoing values or weakening validation', () => {
  for (const [field, value] of Object.entries({
    WIX_CLIENT_ID: 'private-invalid-client', WIX_SITE_ID: 'private-invalid-site',
    SERVER_DATA_KEY: 'private-key-not-base64', PORT: 'private-port',
    PUBLIC_ORIGIN: 'https://private.example/auth/callback?secret=private',
    DATABASE_PATH: '', HOST: '', NODE_ENV: 'private-mode', ALLOW_LOCAL_HTTP: 'private-flag',
  })) {
    try { loadConfig({ ...valid(), [field]: value }); throw Error('accepted invalid config'); }
    catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(String(error)).toContain(field);
      if (value) expect(String(error)).not.toContain(value);
    }
  }
  for (const value of ['a'.repeat(64), 'a'.repeat(32), 'a'.repeat(43), randomBytes(31).toString('base64')])
    expect(() => loadConfig({ ...valid(), SERVER_DATA_KEY: value })).toThrow(ConfigurationError);
});
it('starts compiled backend on Render PORT, serves health, denies unauthenticated access', async () => {
  const probe = createServer();
  await new Promise<void>(r => probe.listen(0, '127.0.0.1', r));
  const port = (probe.address() as { port: number }).port;
  await new Promise<void>(r => probe.close(() => r()));
  const child = spawn(process.execPath, [resolve('server/dist/main.js')], {
    env: { ...valid(), PATH: process.env.PATH, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', d => output += d);
  child.stderr.on('data', d => output += d);
  const stopped = new Promise<void>(r => child.on('close', () => r()));
  try {
    let response: Response | undefined;
    for (let i=0; i<100; i++) {
      if (child.exitCode !== null) throw Error('backend exited before health');
      try { response = await fetch(`http://127.0.0.1:${port}/healthz`); break; }
      catch { await new Promise(r => setTimeout(r, 50)); }
    }
    expect(response?.status).toBe(200);
    expect(await response!.json()).toEqual({ status: 'ok', wixConnectionChecked: false });
    expect(output).toContain(`0.0.0.0:${port}`);
    expect((await fetch(`http://127.0.0.1:${port}/v1/session`)).status).toBe(401);
  } finally { child.kill('SIGTERM'); await stopped; }
}, 15000);
it('startup logs identify invalid fields without exposing secrets', async () => {
  const env = { ...valid(), SERVER_DATA_KEY: 'secret-do-not-log', WIX_SITE_ID: 'private-site' };
  const child = spawn(process.execPath, [resolve('server/dist/main.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stderr.on('data', d => output += d);
  const code = await new Promise<number | null>(r => child.on('close', r));
  expect(code).toBe(1);
  expect(output).toContain('[configuration]: SERVER_DATA_KEY:');
  expect(output).toContain('[configuration]: WIX_SITE_ID:');
  expect(output).not.toContain(env.SERVER_DATA_KEY);
  expect(output).not.toContain(env.WIX_SITE_ID);
});
