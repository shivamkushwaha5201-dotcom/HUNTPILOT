import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampScore,
  clampString,
  clampStringArray,
  generateSafeId,
  ID_PATTERN,
  isValidHttpUrl,
} from '../src/utils/validation.ts';
import { validateFirebaseConfig } from '../src/firebase.ts';

test('validation helpers clamp strings, arrays, and scores safely', () => {
  assert.equal(clampString('   hello world   ', 5), 'hello');
  assert.equal(clampString(null, 10), '');
  assert.equal(clampString(undefined, 10), '');

  assert.deepEqual(clampStringArray(['  one ', '', 'two', 'three'], 2, 3), ['one', 'two']);

  assert.equal(clampScore(84.6), 85);
  assert.equal(clampScore(-10), 0);
  assert.equal(clampScore(140), 100);
  assert.equal(clampScore(Number.NaN), 0);
});

test('isValidHttpUrl accepts empty or http/https URLs and rejects unsafe schemes', () => {
  assert.equal(isValidHttpUrl(''), true);
  assert.equal(isValidHttpUrl('https://huntpilot.example.com/launch'), true);
  assert.equal(isValidHttpUrl('http://localhost:3000'), true);
  assert.equal(isValidHttpUrl('javascript:alert(1)'), false);
  assert.equal(isValidHttpUrl('data:text/html,hi'), false);
  assert.equal(isValidHttpUrl('not a url'), false);
});

test('generateSafeId produces Firestore-rule compatible IDs', () => {
  const id = generateSafeId('proj');
  assert.match(id, ID_PATTERN);
  assert.ok(id.startsWith('proj_'));
  assert.ok(id.length <= 128);
});

test('validateFirebaseConfig detects missing or placeholder config without throwing', () => {
  const missing = validateFirebaseConfig(null);
  assert.equal(missing.configured, false);
  assert.ok(missing.error);

  const placeholder = validateFirebaseConfig({
    apiKey: 'YOUR_API_KEY',
    authDomain: 'example.firebaseapp.com',
    projectId: 'remixed-project-id',
    appId: '',
  });
  assert.equal(placeholder.configured, false);
  assert.match(placeholder.error || '', /apiKey/);
  assert.match(placeholder.error || '', /projectId/);
  assert.match(placeholder.error || '', /appId/);

  const valid = validateFirebaseConfig({
    apiKey: 'AIzaSyFakeTestValue',
    authDomain: 'demo.firebaseapp.com',
    projectId: 'demo-proj',
    appId: '1:123:web:abc',
  });
  assert.equal(valid.configured, true);
  assert.equal(valid.error, null);
  assert.equal(valid.projectId, 'demo-proj');
});
