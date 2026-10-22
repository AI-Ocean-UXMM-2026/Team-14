import {test} from 'node:test';
import assert from 'node:assert/strict';
import {weekPeriod,schoolDate,periodLabel} from '../lib/domain/display';
test('payroll date shortcuts use Monday through Sunday across year boundaries',()=>{assert.deepEqual(weekPeriod('2026-10-22'),{start:'2026-10-19',end:'2026-10-25'});assert.deepEqual(weekPeriod('2026-10-25'),{start:'2026-10-19',end:'2026-10-25'});assert.deepEqual(weekPeriod('2027-01-01',-1),{start:'2026-12-21',end:'2026-12-27'});});
test('invalid shortcut dates are rejected',()=>{assert.throws(()=>weekPeriod('2026-02-31'),/INVALID_DATE/);assert.throws(()=>weekPeriod('not-a-date'),/INVALID_DATE/);});
test('display dates use Yangon even when a timestamp falls on another UTC day',()=>{assert.equal(schoolDate('2026-10-21T20:00:00Z'),'22 Oct 2026');assert.equal(schoolDate('2026-10-22'),'22 Oct 2026');});
test('period labels retain month and year context across calendar boundaries',()=>{assert.match(periodLabel('2026-12-28','2027-01-03'),/Dec 2026.*Jan 2027/);assert.match(periodLabel('2026-10-12','2026-10-18'),/Oct 2026/);});
