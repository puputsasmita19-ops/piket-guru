import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import { ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '../common/Card';

interface RoleGuardProps {
  roles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ roles, children, fallback }) => {
  const { hasRole } = useAuth();

  if (!hasRole(...roles)) {
    if (fallback) return <>{fallback}</>;
    return (
      <Card className="max-w-md mx-auto my-8 text-center border-rose-200 dark:border-rose-900/50">
        <CardContent className="p-6 space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Akses Dibatasi</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Halaman ini hanya dapat diakses oleh peran: <strong>{roles.join(', ')}</strong>.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
};
