import {test} from 'node:test';
import assert from 'node:assert/strict';
import {yangonTimestamp,yangonInput} from '../lib/domain/datetime';
test('school-local datetime is independent of device timezone',()=>{assert.equal(yangonTimestamp('2026-10-12T09:00'),'2026-10-12T02:30:00.000Z');assert.equal(yangonInput('2026-10-12T02:30:59Z'),'2026-10-12T09:00');});
test('invalid calendar dates, seconds and timezones are rejected',()=>{for(const value of ['2026-02-30T09:00','2026-10-12T25:00','2026-10-12T09:00Z','2026-10-12T09:00:00','2026-10-12',''])assert.throws(()=>yangonTimestamp(value));});
