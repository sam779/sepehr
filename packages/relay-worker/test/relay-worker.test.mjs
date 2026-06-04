import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRelayScript } from '../dist/index.js';

const params = {
  relayId: 'relay-test-id',
  portalUrl: 'https://portal.example.test',
  relaySecret: 'relay-secret',
};

test('bakes deployment constants into the relay script', () => {
  const script = buildRelayScript(params);

  assert.match(script, /const RELAY_ID = "relay-test-id";/);
  assert.match(script, /const PORTAL_URL = "https:\/\/portal\.example\.test";/);
  assert.match(script, /const RELAY_SECRET = "relay-secret";/);
});

test('uses worker lifecycle context for background portal callbacks', () => {
  const script = buildRelayScript(params);

  assert.match(script, /function runInBackground\(ctx, promise\)/);
  assert.match(script, /ctx\.waitUntil\(promise\.catch\(\(\) => \{\}\)\)/);
  assert.match(script, /async fetch\(request, env, ctx\)/);
  assert.match(script, /handleTrojanSession\(server, ip, country, ctx\)/);
});

test('keeps connection state and logs on separate portal endpoints', () => {
  const script = buildRelayScript(params);

  assert.match(script, /portalUrl \+ '\/relay\/notify'/);
  assert.match(script, /portalUrl \+ '\/relay\/log'/);
  assert.match(script, /notifyPortal\(ctx, RELAY_ID, 'connect'/);
  assert.match(script, /notifyPortal\(ctx, RELAY_ID, 'disconnect'/);
  assert.match(script, /notifyPortalLog\(ctx, RELAY_ID, 'connect'/);
  assert.match(script, /notifyPortalLog\(ctx, RELAY_ID, 'disconnect'/);
});

test('classifies unsupported cloudflare socket destinations', () => {
  const script = buildRelayScript(params);

  assert.match(script, /function classifySocketError\(error\)/);
  assert.match(script, /unsupported_destination/);
  assert.match(script, /proxy request failed/);
  assert.match(script, /cannot connect to the specified address/);
});

test('gates packet logs behind DEBUG and keeps session summaries', () => {
  const script = buildRelayScript(params);

  assert.match(script, /function debugLog\(\.\.\.args\)/);
  assert.match(script, /debugLog\('\[pipe ws/);
  assert.match(script, /debugLog\('\[pipe tcp/);
  assert.match(script, /console\.log\('\[session\] connected host:'/);
  assert.match(script, /console\.log\('\[session\] closed host:'/);
});
