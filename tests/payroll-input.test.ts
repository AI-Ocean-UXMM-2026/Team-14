import {test} from 'node:test';import assert from 'node:assert/strict';
import {payrollDate,signedMmk} from '../lib/domain/payroll-input';
test('financial form dates reject invalid calendar dates',()=>{assert.equal(payrollDate('2026-10-12'),'2026-10-12');for(const d of ['2026-02-30','2026-1-1','today'])assert.throws(()=>payrollDate(d));});
test('signed whole MMK input preserves exact values and rejects fractions/overflow',()=>{assert.equal(signedMmk('-500'),-500);assert.equal(signedMmk('0'),0);for(const a of ['1.5','1e3','9007199254740992',''])assert.throws(()=>signedMmk(a));});
