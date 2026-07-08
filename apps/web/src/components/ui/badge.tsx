import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
        success:
          'border-transparent bg-success-100 text-success-700 dark:bg-success-700/20 dark:text-success-400',
        warning:
          'border-transparent bg-warning-100 text-warning-700 dark:bg-warning-700/20 dark:text-warning-400',
        error:
          'border-transparent bg-error-100 text-error-700 dark:bg-error-700/20 dark:text-error-400',
        info:
          'border-transparent bg-blue-100 text-blue-700 dark:bg-blue-700/20 dark:text-blue-400',
        muted:
          'border-transparent bg-muted text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            variant === 'success' && 'bg-success-600',
            variant === 'warning' && 'bg-warning-600',
            variant === 'error' && 'bg-error-600',
            variant === 'info' && 'bg-blue-600',
            variant === 'default' && 'bg-primary-foreground',
            !variant && 'bg-current'
          )}
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
