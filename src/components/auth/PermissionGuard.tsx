import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { PermissionKey } from '../../config/permissions';
import { useNavigation } from '../../contexts/NavigationContext';
import { ShieldAlert, ArrowLeft } from '../icons';
import { Card, CardContent } from '../common/Card';
import { Button } from '../common/Button';

import { AuditService } from '../../services/audit/auditService';

interface PermissionGuardProps {
  permission: PermissionKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  children,
  fallback,
}) => {
  const { currentUser, hasPermission } = useAuth();
  const { setActiveTab } = useNavigation();
  const loggedRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!hasPermission(permission) && loggedRef.current !== permission && currentUser) {
      loggedRef.current = permission;
      void AuditService.log({
        userId: currentUser.id,
        userName: currentUser.fullName,
        role: currentUser.role,
        loginId: currentUser.loginId,
        action: 'SECURITY',
        module: 'SECURITY',
        status: 'BLOCKED',
        target: permission,
        details: `Percobaan akses dibatasi: Pengguna tidak memiliki hak akses "${permission}"`,
        metadata: {
          attemptedPermission: permission,
          userRole: currentUser.role,
        },
      });
    }
  }, [permission, hasPermission, currentUser]);

  if (!hasPermission(permission)) {
    if (fallback) return <>{fallback}</>;
    return (
      <Card className="max-w-md mx-auto my-8 text-center border-rose-200 dark:border-rose-900/50">
        <CardContent className="p-6 space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Hak Akses Tidak Mencukupi</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Akun Anda tidak memiliki izin <code>{permission}</code> untuk membuka halaman ini atau izin Anda telah dicabut oleh administrator.
            </p>
          </div>
          <div className="pt-2 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => setActiveTab('dashboard')}
            >
              Kembali ke Beranda
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
};
