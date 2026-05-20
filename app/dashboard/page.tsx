import { DashboardShell } from '@/components/DashboardShell';
import { requireUserPage } from '@/lib/auth';

export default async function DashboardPage() {
  const user = await requireUserPage();

  return (
    <DashboardShell
      user={{
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        canManageUsers: user.canManageUsers,
      }}
    />
  );
}
