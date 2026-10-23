import AccountScreen from '../components/account-screen';
import ResetPasswordForm from '../reset-password/reset-password-form';
export const metadata={title:'Set your password · Saya-Sync',referrer:'no-referrer' as const};
export default function SetPassword(){return <AccountScreen title="Set your password"><ResetPasswordForm purpose="invite"/></AccountScreen>;}
