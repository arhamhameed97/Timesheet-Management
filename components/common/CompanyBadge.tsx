'use client';

interface CompanyBadgeProps {
  company?: {
    id: string;
    name: string;
  } | null;
  className?: string;
}

export function CompanyBadge({ company, className = '' }: CompanyBadgeProps) {
  if (!company) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 ${className}`}
      title={`Company: ${company.name}`}
    >
      {company.name}
    </span>
  );
}






