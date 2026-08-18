export function PageHeader({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <h1 className="font-heading flex items-center gap-2 text-2xl font-semibold tracking-tight">
      <Icon className="size-6 text-accent" />
      {title}
    </h1>
  );
}
