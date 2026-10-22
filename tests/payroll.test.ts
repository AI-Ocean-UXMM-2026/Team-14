import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionPay, localStartDate, eligibility } from '../lib/domain/payroll';
import { sessions } from '../lib/demo';
test('65 minutes at 12,000 MMK/hour',()=>assert.deepEqual(sessionPay('2026-10-20T09:00:00Z','2026-10-20T10:05:00Z',12000),{minutes:65,amount:13000}));
test('round each session before summing',()=>{
 const first=sessionPay('2026-10-20T09:00:00Z','2026-10-20T09:50:00Z',10000);
 const second=sessionPay('2026-10-20T10:00:00Z','2026-10-20T10:01:00Z',10000);
 assert.equal(first.amount,8333);assert.equal(second.amount,167);assert.equal(first.amount+second.amount,8500);
});
test('whole-minute floor',()=>assert.equal(sessionPay('2026-10-20T09:00:59Z','2026-10-20T10:00:00Z',12000).minutes,59));
test('half MMK rounds up',()=>assert.equal(sessionPay('2026-10-20T09:00:00Z','2026-10-20T09:01:00Z',30).amount,1));
test('invalid intervals and rates rejected',()=>{for(const [start,end,rate] of [['bad','bad',100],['2026-10-20','2026-10-19',100],['2026-10-20','2026-10-21',-1],['2026-10-20','2026-10-21',1.5]] as const)assert.throws(()=>sessionPay(start,end,rate));});
test('period uses Yangon start date',()=>assert.equal(localStartDate('2026-10-20T19:00:00Z'),'2026-10-21'));
test('holds missing checkout, pending corrections, and missing rates',()=>{assert.equal(eligibility(sessions[2]),'Pending correction');assert.equal(eligibility(sessions[3]),'Missing checkout');assert.equal(eligibility({...sessions[0],rate:null}),'Missing rate');});
