'use client';
import {useActionState,useState} from 'react';
import {mutateWorkspace} from './actions';
type Choice={id:string;label:string};
type Props={operation:string;entity:string;requestKey:string;version?:number;label:string;start?:string;end?:string;dates?:boolean;reason?:boolean;reasonRequired?:boolean;decisions?:string[];teachers?:Choice[];classes?:Choice[]};
export default function MutationForm(p:Props){
 const [state,action,pending]=useActionState(mutateWorkspace,{ok:false,message:''});
 const [values,setValues]=useState({start:p.start??'',end:p.end??'',reason:'',entity:p.entity,class_id:p.classes?.[0]?.id??'',decision:p.decisions?.[0]??''});
 const change=(name:keyof typeof values,value:string)=>setValues(v=>({...v,[name]:value}));
 return <form action={action} className="mutation-form"><input type="hidden" name="operation" value={p.operation}/><input type="hidden" name="key" value={p.requestKey}/><input type="hidden" name="version" value={p.version??''}/>{!p.teachers&&<input type="hidden" name="entity" value={p.entity}/>}
 {p.teachers&&<label>Teacher<select name="entity" value={values.entity} onChange={e=>change('entity',e.target.value)} required>{p.teachers.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>}
 {p.classes&&<label>Class<select name="class_id" value={values.class_id} onChange={e=>change('class_id',e.target.value)} required>{p.classes.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>}
 {p.dates&&<><label>Start · Asia/Yangon<input name="start" type="datetime-local" step="60" value={values.start} onChange={e=>change('start',e.target.value)} required/></label><label>End · Asia/Yangon<input name="end" type="datetime-local" step="60" value={values.end} onChange={e=>change('end',e.target.value)} required/></label></>}
 {p.decisions&&<label>Decision<select name="decision" value={values.decision} onChange={e=>change('decision',e.target.value)}>{p.decisions.map(d=><option key={d} value={d}>{d}</option>)}</select></label>}
 {p.reason&&<label>Reason{p.reasonRequired?' (required)':' (required for rejection)'}<textarea name="reason" maxLength={2000} value={values.reason} onChange={e=>change('reason',e.target.value)} required={p.reasonRequired||values.decision==='rejected'} rows={3}/></label>}
 <button className="button" disabled={pending||state.ok}>{pending?'Saving…':state.ok?'Saved':p.label}</button>{state.message&&<p role={state.ok?'status':'alert'} className={state.ok?'saved-message':'error-message'}>{state.message}</p>}
 </form>;
}
