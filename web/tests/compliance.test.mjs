import test from 'node:test';
import assert from 'node:assert/strict';
import { assess, summaryText } from '../js/compliance.js';

const det = (name) => ({ name, score: 0.9, box: [0, 0, 1, 1] });

test('violation when any no_* class is present', () => {
  const r = assess([det('Person'), det('Person'), det('no_helmet'), det('no_helmet'), det('no_gloves'), det('vest')]);
  assert.equal(r.status, 'VIOLATION');
  assert.equal(r.workers, 2);
  assert.equal(r.violationTotal, 3);
  assert.deepEqual(r.violations.map((v) => [v.name, v.count]), [['no_helmet', 2], ['no_gloves', 1]]);
  assert.equal(summaryText(r), '2 tanpa helm, 1 tanpa sarung tangan');
});

test('safe when workers present without violations', () => {
  const r = assess([det('Person'), det('helmet'), det('vest')]);
  assert.equal(r.status, 'SAFE');
  assert.equal(r.ppe.length, 2);
});

test('safe when PPE detected even if person box is missed', () => {
  assert.equal(assess([det('helmet')]).status, 'SAFE');
});

test('no worker when nothing relevant detected', () => {
  assert.equal(assess([]).status, 'NO_WORKER');
});

test('"none" (torso without vest) counts as a violation', () => {
  const r = assess([det('Person'), det('helmet'), det('none')]);
  assert.equal(r.status, 'VIOLATION');
  assert.equal(summaryText(r), '1 tanpa rompi');
});
