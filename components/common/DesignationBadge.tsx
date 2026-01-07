'use client';

interface DesignationBadgeProps {
  designation?: {
    id: string;
    name: string;
  } | null;
  className?: string;
}

export function DesignationBadge({ designation, className = '' }: DesignationBadgeProps) {
  if (!designation) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800 ${className}`}
    >
      {designation.name}
    </span>
  );
}













