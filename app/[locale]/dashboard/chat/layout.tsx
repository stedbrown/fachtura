export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="h-full -m-4 md:-m-6">
      {children}
    </div>
  )
}

