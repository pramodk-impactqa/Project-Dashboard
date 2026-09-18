export default function Loader({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#090B1F]">
      <div className="w-64 space-y-3" aria-live="polite">
        <div className="fx-skeleton h-10 w-40 mx-auto" />
        <div className="fx-skeleton h-24 w-full" />
        <div className="grid grid-cols-2 gap-3">
          <div className="fx-skeleton h-16" />
          <div className="fx-skeleton h-16" />
        </div>
      </div>
      {message && <p className="mt-6 text-sm font-medium text-[#A7A9C0]">{message}</p>}
    </div>
  );
}
