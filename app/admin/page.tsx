import { AdminUsersPanel } from '@/components/AdminUsersPanel';
import { requireAdminPage } from '@/lib/auth';

export default async function AdminPage() {
  const user = await requireAdminPage();

  return (
    <AdminUsersPanel
      currentUser={{
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role as 'admin' | 'user',
      }}
    />
  );
}
