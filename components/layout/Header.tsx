'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LogOut, User, Settings, X } from 'lucide-react';
import { DesignationBadge } from '@/components/common/DesignationBadge';
import { RoleBadge } from '@/components/common/RoleBadge';
import { UserRole } from '@prisma/client';
import { CompanySelector } from '@/components/super-admin/CompanySelector';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  company?: {
    name: string;
  };
  designation?: {
    id: string;
    name: string;
  } | null;
}

export function Header() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedUserName, setImpersonatedUserName] = useState<string | null>(null);

  useEffect(() => {
    const checkImpersonation = () => {
      const impersonating = localStorage.getItem('isImpersonating') === 'true';
      const name = localStorage.getItem('impersonatedUserName');
      setIsImpersonating(impersonating);
      setImpersonatedUserName(name);
    };

    checkImpersonation();
    
    const fetchUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          localStorage.removeItem('token');
          router.push('/login');
          return;
        }

        const data = await response.json();
        setUser(data.user);
      } catch (error) {
        console.error('Failed to fetch user:', error);
        localStorage.removeItem('token');
        router.push('/login');
      }
    };

    fetchUser();
    
    // Check for impersonation changes periodically
    const interval = setInterval(checkImpersonation, 1000);
    return () => clearInterval(interval);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    document.cookie = 'token=; path=/; max-age=0';
    router.push('/login');
  };

  const handleStopImpersonation = () => {
    const originalToken = localStorage.getItem('originalToken');
    
    if (originalToken) {
      // Restore original token
      localStorage.setItem('token', originalToken);
      document.cookie = `token=${originalToken}; path=/; max-age=${60 * 60 * 24 * 7}`;
    }
    
    // Clear impersonation flags
    localStorage.removeItem('isImpersonating');
    localStorage.removeItem('impersonatedUserId');
    localStorage.removeItem('impersonatedUserName');
    localStorage.removeItem('originalToken');
    
    // Reload to update user context
    window.location.href = '/dashboard';
  };

  if (!user) {
    return null;
  }

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      {isImpersonating && (
        <div className="sticky top-0 z-20 bg-yellow-500 text-yellow-900 border-b border-yellow-600">
          <div className="flex items-center justify-between px-6 py-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Impersonating:</span>
              <span>{impersonatedUserName || 'Unknown User'}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStopImpersonation}
              className="text-yellow-900 hover:bg-yellow-600 hover:text-yellow-950"
            >
              <X className="mr-2 h-4 w-4" />
              Stop Impersonation
            </Button>
          </div>
        </div>
      )}
      <header className={`sticky z-10 border-b bg-background ${isImpersonating ? 'top-[40px]' : 'top-0'}`}>
        <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground">
            {user.company?.name || 'PunchIn'}
          </h1>
          {user.role === UserRole.SUPER_ADMIN && <CompanySelector />}
        </div>
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar>
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-2">
                  <p className="text-sm font-medium leading-none">{user.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <RoleBadge role={user.role} />
                    {user.designation && (
                      <DesignationBadge designation={user.designation} />
                    )}
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
    </>
  );
}

