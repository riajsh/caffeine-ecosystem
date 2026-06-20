type PageHeaderProps = {
  title: string;
  description?: string;
  children?: React.ReactNode;
};

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-border px-8 py-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-display font-medium text-foreground">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-body text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}
