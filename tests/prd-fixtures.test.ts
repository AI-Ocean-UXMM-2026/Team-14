import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sessionPay,localStartDate} from '../lib/domain/payroll';
const fromMinutes=(minutes:number,rate:number)=>sessionPay('2026-10-12T00:00:00Z',new Date(Date.parse('2026-10-12T00:00:00Z')+minutes*60000).toISOString(),rate);
// PRD §13 gives teacher aggregates, not the underlying twelve session rows.
// These check the published summary arithmetic, not per-session integration.
test('AT26 summary arithmetic: published base teacher totals',()=>{
 const rows=[{minutes:210,rate:10000,amount:35000},{minutes:125,rate:12000,amount:25000},{minutes:180,rate:11000,amount:33000},{minutes:90,rate:10000,amount:15000},{minutes:180,rate:13000,amount:39000}];
 for(const row of rows)assert.equal(fromMinutes(row.minutes,row.rate).amount,row.amount);
 assert.equal(rows.reduce((n,r)=>n+r.minutes,0),785);
 assert.equal(rows.reduce((n,r)=>n+r.amount,0),147000);
});
test('AT27 summary arithmetic: approved correction increments',()=>{
 const cr001=fromMinutes(105,10000),cr002=fromMinutes(90,12000);
 assert.equal(cr001.amount,17500);assert.equal(cr002.amount,18000);
 assert.equal(785+cr001.minutes+cr002.minutes,980);
 assert.equal(147000+cr001.amount+cr002.amount,182500);
});
test('AT10/AT11 calculation components; original source fixtures not supplied',()=>{
 assert.deepEqual(fromMinutes(65,12000),{minutes:65,amount:13000});
 assert.deepEqual(fromMinutes(60,13000),{minutes:60,amount:13000});
});
test('AT13 overnight duration and Yangon start date',()=>{
 assert.deepEqual(sessionPay('2026-10-12T23:30:00+06:30','2026-10-13T00:30:00+06:30',12000),{minutes:60,amount:12000});
 assert.equal(localStartDate('2026-10-12T23:30:00+06:30'),'2026-10-12');
});
