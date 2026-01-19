'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Company {
  id: string;
  name: string;
  email: string;
}

export function CompanySelector() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompanyContext();
    fetchCompanies();
  }, []);

  const fetchCompanyContext = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/super-admin/company-context', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedCompanyId(data.companyId);
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
    } finally {
      setLoading(false);
    }
  };

  const handleCompanyChange = async (companyId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/super-admin/company-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ companyId }),
      });

      if (response.ok) {
        setSelectedCompanyId(companyId);
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('companyContextChanged', { 
          detail: { companyId } 
        }));
        // Reload the page to apply context
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to set company context:', error);
    }
  };

  const handleClearContext = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/super-admin/company-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ companyId: null }),
      });

      if (response.ok) {
        setSelectedCompanyId(null);
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('companyContextChanged', { 
          detail: { companyId: null } 
        }));
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to clear company context:', error);
    }
  };

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select
        value={selectedCompanyId || 'none'}
        onValueChange={(value) => {
          if (value === 'none') {
            handleClearContext();
          } else {
            handleCompanyChange(value);
          }
        }}
        disabled={loading}
      >
        <SelectTrigger className="w-[250px]">
          <SelectValue placeholder="Select company context">
            {selectedCompany ? selectedCompany.name : 'No company selected'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No company selected (Global view)</SelectItem>
          {companies.map((company) => (
            <SelectItem key={company.id} value={company.id}>
              {company.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedCompanyId && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearContext}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
