import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Saya-Sync · Teaching records',description:'Teaching records, reviews and transparent teacher payments'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><head>{['styles','responsive','controls','theme-blue','refinements-v03','typography-accessibility','flows','live-review'].map(name=><link key={name} rel="stylesheet" href={'/prototype/'+name+'.css'}/>)}</head><body>{children}</body></html>}
