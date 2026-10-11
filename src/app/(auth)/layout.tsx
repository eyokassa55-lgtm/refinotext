export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-mint px-4 py-6 sm:px-6">
      {children}
    </div>
  );
}
