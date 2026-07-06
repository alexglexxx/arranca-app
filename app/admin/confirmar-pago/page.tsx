import { redirect } from 'next/navigation';

export default function AdminConfirmarPagoRedirectPage() {
  redirect('/admin/solicitudes');
}
