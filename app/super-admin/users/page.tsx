'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Search, Filter, Eye, Edit, Building2, Users, UserCheck, UserX } from 'lucide-react';
import { UserRole } from '@prisma/client';
import { RoleBadge } from '@/components/common/RoleBadge';
import { format } from 'date-fns';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  company?: {
    id: string;
    name: string;
    email: string;
  } | null;
  designation?: {
    id: string;
    name: string;
  } | null;
  manager?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface Company {
  id: string;
  name: string;
}

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [companyContext, setCompanyContext] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchCompanies();
    fetchCompanyContext();
  }, []);

  // Listen for company context changes from the header selector
  useEffect(() => {
    const handleCompanyContextChange = () => {
      // Small delay to ensure cookie is set
      setTimeout(() => {
        fetchCompanyContext();
        fetchUsers();
      }, 100);
    };

    window.addEventListener('companyContextChanged', handleCompanyContextChange);

    // Also listen for visibility/focus changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchCompanyContext();
        fetchUsers();
      }
    };

    const handleFocus = () => {
      fetchCompanyContext();
      fetchUsers();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('companyContextChanged', handleCompanyContextChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Update filter when company context changes
  useEffect(() => {
    if (companyContext) {
      setFilterCompany(companyContext.id);
    } else {
      setFilterCompany('all');
    }
  }, [companyContext]);

  useEffect(() => {
    applyFilters();
  }, [users, searchTerm, filterRole, filterCompany, filterStatus]);

  const fetchCompanyContext = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/super-admin/company-context', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include', // Include cookies
      });

      if (response.ok) {
        const data = await response.json();
        const newCompanyContext = data.company || null;
        
        // Only update if company context actually changed
        if (newCompanyContext?.id !== companyContext?.id) {
          setCompanyContext(newCompanyContext);
          // Auto-filter by company context if set, otherwise show all
          if (data.companyId) {
            setFilterCompany(data.companyId);
          } else {
            // Global view - show all companies
            setFilterCompany('all');
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch company context:', error);
    }
  };

  const fetchCompanies = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/companies', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCompanies(data.companies || []);
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/super-admin/users', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include', // Include cookies for company context
      });

      if (response.ok) {
        const data = await response.json();
        const fetchedUsers = data.users || [];
        setUsers(fetchedUsers);
        // applyFilters will be called automatically via useEffect
      } else {
        console.error('Failed to fetch users');
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...users];

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.name.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower) ||
          user.company?.name.toLowerCase().includes(searchLower) ||
          user.designation?.name.toLowerCase().includes(searchLower)
      );
    }

    // Role filter
    if (filterRole !== 'all') {
      filtered = filtered.filter((user) => user.role === filterRole);
    }

    // Company filter
    if (filterCompany !== 'all') {
      filtered = filtered.filter((user) => user.company?.id === filterCompany);
    }

    // Status filter
    if (filterStatus !== 'all') {
      if (filterStatus === 'active') {
        filtered = filtered.filter((user) => user.isActive);
      } else if (filterStatus === 'inactive') {
        filtered = filtered.filter((user) => !user.isActive);
      }
    }

    setFilteredUsers(filtered);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleCounts = () => {
    const counts = {
      all: users.length,
      SUPER_ADMIN: 0,
      COMPANY_ADMIN: 0,
      MANAGER: 0,
      TEAM_LEAD: 0,
      EMPLOYEE: 0,
    };

    users.forEach((user) => {
      if (user.role in counts) {
        counts[user.role as keyof typeof counts]++;
      }
    });

    return counts;
  };

  const roleCounts = getRoleCounts();

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">All Users</h1>
          <p className="text-muted-foreground mt-1">
            {companyContext
              ? `Viewing users for: ${companyContext.name}`
              : 'Global View - Manage and view all users across all companies'}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{users.length}</div>
              <p className="text-xs text-muted-foreground">Total Users</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{roleCounts.COMPANY_ADMIN}</div>
              <p className="text-xs text-muted-foreground">Company Admins</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{roleCounts.MANAGER}</div>
              <p className="text-xs text-muted-foreground">Managers</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{roleCounts.TEAM_LEAD}</div>
              <p className="text-xs text-muted-foreground">Team Leads</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{roleCounts.EMPLOYEE}</div>
              <p className="text-xs text-muted-foreground">Employees</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="All roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value={UserRole.SUPER_ADMIN}>Super Admin</SelectItem>
                    <SelectItem value={UserRole.COMPANY_ADMIN}>Company Admin</SelectItem>
                    <SelectItem value={UserRole.MANAGER}>Manager</SelectItem>
                    <SelectItem value={UserRole.TEAM_LEAD}>Team Lead</SelectItem>
                    <SelectItem value={UserRole.EMPLOYEE}>Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Company</label>
                <Select value={filterCompany} onValueChange={setFilterCompany}>
                  <SelectTrigger>
                    <SelectValue placeholder="All companies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Users ({filteredUsers.length})</CardTitle>
              <Button onClick={fetchUsers} variant="outline" size="sm">
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No users found matching your filters.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback className="bg-primary text-primary-foreground">
                                {getInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{user.name}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <RoleBadge role={user.role} />
                        </TableCell>
                        <TableCell>
                          {user.company ? (
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span>{user.company.name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">No company</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.designation ? (
                            <Badge variant="outline">{user.designation.name}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.manager ? (
                            <div className="text-sm">
                              <div className="font-medium">{user.manager.name}</div>
                              <div className="text-muted-foreground text-xs">
                                {user.manager.email}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.isActive ? (
                            <Badge className="bg-green-600">
                              <UserCheck className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <UserX className="h-3 w-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(user.createdAt), 'MMM d, yyyy')}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
