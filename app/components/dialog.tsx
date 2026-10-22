'use client';
import {createContext,useContext,useEffect,useId,useRef,useState} from 'react';
const CloseContext=createContext<(()=>void)|null>(null);
export function FormActions({children}:{children:React.ReactNode}){const close=useContext(CloseContext);return close?<div className="form-actions"><button type="button" className="btn" onClick={close}>Cancel</button>{children}</div>:<>{children}</>}
export default function Dialog({title,eyebrow='WORKSPACE',onClose,children}:{title:string;eyebrow?:string;onClose:()=>void;children:React.ReactNode}){
 const heading=useId(),dialog=useRef<HTMLDialogElement>(null),[dirty,setDirty]=useState(false),[confirm,setConfirm]=useState(false);
 const close=()=>{if(dirty)setConfirm(true);else onClose();};
 useEffect(()=>{const target=dialog.current,previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;target?.showModal();document.body.style.overflow='hidden';return()=>{target?.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();else document.getElementById('main')?.focus();};},[]);
 return <dialog ref={dialog} aria-labelledby={heading} className="react-dialog" onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget)close();}}><CloseContext.Provider value={close}><section className="modal-panel" onChange={()=>setDirty(true)}><header><div><div className="eyebrow">{eyebrow}</div><h2 id={heading}>{title}</h2></div><button type="button" className="icon-button" aria-label="Close dialog" onClick={close}>×</button></header><div className="dialog-body">{children}</div>{confirm&&<div className="form-error"><p>Discard unsaved changes?</p><div className="form-actions"><button className="btn" onClick={()=>setConfirm(false)}>Keep editing</button><button className="btn danger" onClick={onClose}>Discard changes</button></div></div>}</section></CloseContext.Provider></dialog>;
}
