export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-black">
      {children}
    </div>
  );
}
