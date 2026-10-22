'use client';
import PeriodFields from '@/app/components/period-fields';
import ValidatedForm from '@/app/components/validated-form';
import {FormActions} from '@/app/components/dialog';
import Link from 'next/link';
import {useActionState,useEffect,useState,useRef} from 'react';
import {mutatePayroll} from './actions';
type Props={compact?:boolean;start?:string;end?:string;onSaved?:(runId?:string)=>void;operation:string;entity?:string;version?:number;requestKey:string;label:string;teacherId?:string;teachers?:{id:string;name:string}[];initialAmount?:number;initialReason?:string;initialReference?:string;today?:string};
export default function PayrollForm(p:Props){
 const [state,action,pending]=useActionState(mutatePayroll,{ok:false,message:''});
 const [values,setValues]=useState({start:p.start??'',end:p.end??'',teacher_id:p.teacherId??p.teachers?.[0]?.id??'',amount:String(p.initialAmount??0),reason:p.initialReason??'',paid_on:p.today??'',method:'',reference:p.initialReference??'',confirmed:false});
 const savedCallback=useRef(p.onSaved);savedCallback.current=p.onSaved;useEffect(()=>{if(state.ok)savedCallback.current?.(state.runId);},[state.ok,state.runId]);
 const set=(name:keyof typeof values,value:string|boolean)=>setValues(v=>({...v,[name]:value}));
 const adjustment=p.operation==='set_payroll_adjustment',payment=p.operation==='record_payment',reason=adjustment||['void_payroll','reverse_payment'].includes(p.operation),confirm=['approve_payroll','record_payment','reverse_payment','void_payroll'].includes(p.operation);
 return <ValidatedForm action={action} serverError={!state.ok?state.message:undefined} submitting={pending} validate={(data):Record<string,string>=>{if(p.operation!=='calculate_payroll')return {};const start=String(data.get('start')??''),end=String(data.get('end')??'');return start&&end&&end<start?{end:'Choose an end date on or after the start date.'}:{};}} className={p.compact?"payroll-period-form":"mutation-form"}><input type="hidden" name="operation" value={p.operation}/><input type="hidden" name="entity" value={p.entity??''}/><input type="hidden" name="version" value={p.version??''}/><input type="hidden" name="key" value={p.requestKey}/>
 {p.operation==='calculate_payroll'&&<PeriodFields start={values.start} end={values.end} today={p.today??p.end??'2026-01-01'} onChange={(start,end)=>setValues(v=>({...v,start,end}))}/>}
 {p.operation==='calculate_payroll'&&(values.start!==p.start||values.end!==p.end)&&<p className="period-hint">Calculate a draft to update the preview for these dates.</p>}
 {p.teachers&&<label>Teacher<select name="teacher_id" value={values.teacher_id} onChange={e=>set('teacher_id',e.target.value)} required>{p.teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
 {p.teacherId&&<input type="hidden" name="teacher_id" value={p.teacherId}/>}
 {adjustment&&<label>Signed adjustment · whole MMK<input name="amount" type="text" inputMode="numeric" pattern="-?[0-9]+" value={values.amount} onChange={e=>set('amount',e.target.value)} required/><span className="muted">Replaces this teacher’s current draft adjustment. Earlier values remain in audit.</span></label>}
 {reason&&<label>Reason<textarea aria-label="Reason" name="reason" rows={3} maxLength={2000} value={values.reason} onChange={e=>set('reason',e.target.value)} required/></label>}
 {payment&&<><label>Actual payment date<input type="date" name="paid_on" value={values.paid_on} onChange={e=>set('paid_on',e.target.value)} required/></label><label>Method<select name="method" value={values.method} onChange={e=>set('method',e.target.value)} required><option value="">Choose a method</option><option value="Bank transfer">Bank transfer</option><option value="Cash">Cash</option></select></label></>}
 {(payment||adjustment)&&<label>{payment?'Payment reference / cash receipt note':'Prior payroll reference (optional)'}<input name="reference" maxLength={500} value={values.reference} onChange={e=>set('reference',e.target.value)} required={payment}/></label>}
 {confirm&&<label className="confirm-box"><input type="checkbox" checked={values.confirmed} onChange={e=>set('confirmed',e.target.checked)} required/><span>{p.operation==='approve_payroll'?'I reviewed the included and held records and teacher net amounts.':payment?'I confirm the full external payment was already made.':p.operation==='reverse_payment'?'I confirm this reverses the record only; no money is transferred.':'I confirm this unpaid run should be voided and its allocations released.'}</span></label>}
 <FormActions><button className="btn primary" disabled={pending||state.ok||(confirm&&!values.confirmed)}>{pending?'Saving…':state.ok?'Saved':p.label}</button></FormActions>{state.ok&&state.message&&<p role="status" className="saved-message">{state.message}</p>}{state.ok&&state.runId&&<Link href={'/workspace/payroll?run='+state.runId}>Open calculated draft →</Link>}
 </ValidatedForm>;
}
