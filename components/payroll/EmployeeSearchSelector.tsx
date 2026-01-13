'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Users, Search, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  name: string;
  email: string;
  paymentType?: 'HOURLY' | 'SALARY' | null;
  hourlyRate?: number | null;
  monthlySalary?: number | null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface EmployeeSearchSelectorProps {
  employees: Employee[];
  selectedEmployeeId: string | null;
  onSelect: (employeeId: string | null) => void;
  placeholder?: string;
  className?: string;
}

export function EmployeeSearchSelector({
  employees,
  selectedEmployeeId,
  onSelect,
  placeholder = 'Search employees...',
  className,
}: EmployeeSearchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedEmployee = employees.find((emp) => emp.id === selectedEmployeeId);

  // Filter employees based on search query
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) {
      return employees;
    }
    const query = searchQuery.toLowerCase();
    return employees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(query) ||
        emp.email.toLowerCase().includes(query)
    );
  }, [employees, searchQuery]);

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredEmployees.length, searchQuery]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredEmployees.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredEmployees[highlightedIndex]) {
          handleSelect(filteredEmployees[highlightedIndex].id);
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredEmployees, highlightedIndex]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current && highlightedIndex >= 0) {
      const items = listRef.current.children;
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }, [highlightedIndex]);

  const handleSelect = (employeeId: string | null) => {
    onSelect(employeeId);
    setIsOpen(false);
    setSearchQuery('');
    inputRef.current?.blur();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleSelect(null);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div ref={containerRef} className={cn('relative w-full max-w-sm', className)}>
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={selectedEmployee ? selectedEmployee.name : placeholder}
            value={isOpen ? searchQuery : ''}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="pl-10 pr-10 h-10 bg-background border-2 transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {selectedEmployee && !isOpen && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-card border-2 border-border rounded-lg shadow-xl max-h-[300px] overflow-hidden transition-all duration-200 ease-out opacity-100 scale-100">
            <div className="p-2 border-b border-border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>
                  {filteredEmployees.length === 0
                    ? 'No employees found'
                    : `${filteredEmployees.length} employee${filteredEmployees.length !== 1 ? 's' : ''} found`}
                </span>
              </div>
            </div>

            <div
              ref={listRef}
              className="overflow-y-auto max-h-[240px] p-1"
            >
              {/* View All Option */}
              <button
                onClick={() => handleSelect(null)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors hover:bg-accent',
                  selectedEmployeeId === null && 'bg-accent font-medium'
                )}
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">View All Payroll</div>
                  <div className="text-xs text-muted-foreground">
                    Show all employees
                  </div>
                </div>
                {selectedEmployeeId === null && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>

              {/* Employee List */}
              {filteredEmployees.map((employee, index) => (
                <button
                  key={employee.id}
                  onClick={() => handleSelect(employee.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors hover:bg-accent',
                    highlightedIndex === index && 'bg-accent',
                    selectedEmployeeId === employee.id && 'bg-accent font-medium'
                  )}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold text-xs flex-shrink-0">
                    {getInitials(employee.name)}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-medium truncate">{employee.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {employee.email}
                    </div>
                  </div>
                  {employee.paymentType && (
                    <div className="text-xs text-muted-foreground flex-shrink-0 px-2 py-1 rounded bg-muted/50">
                      {employee.paymentType === 'HOURLY' && employee.hourlyRate
                        ? `${formatCurrency(employee.hourlyRate)}/hr`
                        : employee.paymentType === 'SALARY' && employee.monthlySalary
                        ? `${formatCurrency(employee.monthlySalary)}/mo`
                        : employee.paymentType}
                    </div>
                  )}
                  {selectedEmployeeId === employee.id && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </button>
              ))}

              {filteredEmployees.length === 0 && searchQuery && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No employees match &quot;{searchQuery}&quot;
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
