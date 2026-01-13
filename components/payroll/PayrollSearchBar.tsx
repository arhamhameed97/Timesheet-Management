'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Users, Search, X, Check, Filter, ChevronDown, 
  Calendar as CalendarIcon, DollarSign, Clock 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PayrollStatus } from '@prisma/client';

interface Employee {
  id: string;
  name: string;
  email: string;
  paymentType?: 'HOURLY' | 'SALARY' | null;
  hourlyRate?: number | null;
  monthlySalary?: number | null;
}

interface PayrollSearchBarProps {
  employees: Employee[];
  selectedEmployeeId: string | null;
  onSelect: (employeeId: string | null) => void;
  onFilterChange?: (filters: {
    paymentType: string | null;
    status: string | null;
    month: string | null;
    year: string | null;
  }) => void;
  className?: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function PayrollSearchBar({
  employees,
  selectedEmployeeId,
  onSelect,
  onFilterChange,
  className,
}: PayrollSearchBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    paymentType: null as string | null,
    status: null as string | null,
    month: null as string | null,
    year: null as string | null,
  });

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

  const handleFilterChange = (key: string, value: string | null) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  const clearFilters = () => {
    const clearedFilters = {
      paymentType: null,
      status: null,
      month: null,
      year: null,
    };
    setFilters(clearedFilters);
    onFilterChange?.(clearedFilters);
  };

  const activeFiltersCount = Object.values(filters).filter(Boolean).length;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className={cn('w-full space-y-4', className)}>
      {/* Main Search Bar */}
      <div className="relative w-full">
        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div ref={containerRef} className="flex-1 relative">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
              <Input
                ref={inputRef}
                type="text"
                placeholder={selectedEmployee ? selectedEmployee.name : 'Search employees by name or email...'}
                value={isOpen ? searchQuery : ''}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!isOpen) setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                className="h-12 pl-12 pr-12 text-base bg-card border-2 transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-lg"
              />
              {selectedEmployee && !isOpen && (
                <button
                  onClick={handleClear}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear selection"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Dropdown */}
            {isOpen && (
              <div className="absolute z-50 w-full mt-2 bg-card border-2 border-border rounded-lg shadow-xl max-h-[400px] overflow-hidden transition-all duration-200 ease-out">
                <div className="p-3 border-b border-border bg-muted/30">
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
                  className="overflow-y-auto max-h-[340px] p-2"
                >
                  {/* View All Option */}
                  <button
                    onClick={() => handleSelect(null)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors hover:bg-accent mb-1',
                      selectedEmployeeId === null && 'bg-accent font-medium'
                    )}
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                      <Users className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">View All Payroll</div>
                      <div className="text-xs text-muted-foreground">
                        Show all employees
                      </div>
                    </div>
                    {selectedEmployeeId === null && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </button>

                  {/* Employee List */}
                  {filteredEmployees.map((employee, index) => (
                    <button
                      key={employee.id}
                      onClick={() => handleSelect(employee.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors hover:bg-accent mb-1',
                        highlightedIndex === index && 'bg-accent',
                        selectedEmployeeId === employee.id && 'bg-accent font-medium'
                      )}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold text-sm flex-shrink-0">
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
                        <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                    </button>
                  ))}

                  {filteredEmployees.length === 0 && searchQuery && (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      No employees match &quot;{searchQuery}&quot;
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Filter Toggle Button */}
          <Button
            type="button"
            variant={showFilters ? 'default' : 'outline'}
            onClick={() => setShowFilters(!showFilters)}
            className="h-12 px-4 relative"
          >
            <Filter className="h-5 w-5 mr-2" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-primary-foreground/20 rounded-full text-xs font-semibold">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-card border-2 border-border rounded-lg p-4 space-y-4 animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filter Payroll Records
            </h3>
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Clear All
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Payment Type Filter */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Payment Type
              </label>
              <Select
                value={filters.paymentType || 'all'}
                onValueChange={(value) =>
                  handleFilterChange('paymentType', value === 'all' ? null : value)
                }
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="HOURLY">Hourly</SelectItem>
                  <SelectItem value="SALARY">Salary</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Status
              </label>
              <Select
                value={filters.status || 'all'}
                onValueChange={(value) =>
                  handleFilterChange('status', value === 'all' ? null : value)
                }
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value={PayrollStatus.PENDING}>Pending</SelectItem>
                  <SelectItem value={PayrollStatus.APPROVED}>Approved</SelectItem>
                  <SelectItem value={PayrollStatus.REJECTED}>Rejected</SelectItem>
                  <SelectItem value={PayrollStatus.PAID}>Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Month Filter */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
                Month
              </label>
              <Select
                value={filters.month || 'all'}
                onValueChange={(value) =>
                  handleFilterChange('month', value === 'all' ? null : value)
                }
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {months.map((month, index) => (
                    <SelectItem key={index} value={(index + 1).toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Year Filter */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
                Year
              </label>
              <Select
                value={filters.year || 'all'}
                onValueChange={(value) =>
                  handleFilterChange('year', value === 'all' ? null : value)
                }
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
