import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'SayaSync · Teaching, accounted for', description: 'Part-time teacher sessions and payroll management' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
