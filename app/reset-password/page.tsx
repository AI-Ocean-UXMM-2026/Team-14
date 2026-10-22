import AccountScreen from '../components/account-screen';
import ResetPasswordForm from './reset-password-form';
export const metadata={title:'Reset password · Saya-Sync',referrer:'no-referrer' as const};
export default function ResetPassword(){return <AccountScreen title="Reset password"><ResetPasswordForm/></AccountScreen>;}
