import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prototype} from '../lib/prototype/model';
test('uploaded twelve-session fixture: base and corrected payroll totals',()=>{
 const store=new prototype.Store();assert.equal(store.data.sessions.length,12);
 store.verify('S0001','Verified','Reviewed');store.verify('S0002','Verified','Reviewed');
 const base=store.draft('2026-10-12','2026-10-18');assert.equal(store.total(base).minutes,785);assert.equal(store.total(base).net,147000);
 assert.equal(store.session('S0003').originalStart,'2026-10-12T13:00:00+06:30');assert.equal(prototype.mins(store.session('S0003').start,store.session('S0003').end),65);
 for(const id of ['CR001','CR002']){const c=store.data.corrections.find(c=>c.id===id)!;store.review(id,'Approved','Reviewed');store.verify(c.session,'Verified','Reviewed');}
 const corrected=store.draft('2026-10-12','2026-10-18');assert.equal(store.total(corrected).minutes,980);assert.equal(store.total(corrected).net,182500);
});
test('prototype permits next class after pending correction requested end; overlap remains blocked',()=>{
 const store=new prototype.Store();assert.equal(store.checkInBlocker('T002','2026-10-15T14:00:00+06:30')?.id,'S0008');
 assert.equal(store.checkInBlocker('T002','2026-10-15T15:00:00+06:30'),null);
 assert.throws(()=>store.checkIn('T002','C103','2026-10-15T14:00:00+06:30'),/open session/);
 const next=store.checkIn('T002','C103','2026-10-15T15:01:00+06:30');assert.equal(next.end,null);assert.equal(store.session('S0008').end,null);
 assert.throws(()=>store.checkIn('T002','C101','2026-10-15T15:02:00+06:30'),/open session/);
});
test('demo snapshots, payments and original times remain consistent',()=>{
 const store=new prototype.Store();store.verify('S0001','Verified','Reviewed');store.verify('S0002','Verified','Reviewed');
 const draft=store.draft('2026-10-12','2026-10-18'),run=store.approve(draft),before=store.total(run).net;
 store.teacher('T001').rates.push({from:'2026-10-01',rate:50000});assert.equal(store.total(run).net,before);
 const payment=store.pay(run.id,'T001','Cash','2026-10-22','Fictional receipt');assert.equal(payment.amount,35000);
 assert.throws(()=>store.pay(run.id,'T001','Cash','2026-10-22','Duplicate'),/already paid/);
 store.reversePayment(payment.id,'Wrong reference');assert.equal(store.data.payments[0].status,'Reversed');
});
