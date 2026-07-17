import { useCallback, useRef, useState } from "react";

interface Props {
  onFile: (file: File) => void;
  busy: boolean;
  error: string | null;
}

export function UploadCard({ onFile, busy, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      const f = e.dataTransfer.files?.[0];
      if (f) onFile(f);
    },
    [onFile],
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-10 text-center bg-white shadow-card transition-colors ${
          drag ? "border-ink-950 bg-ink-50" : "border-ink-200"
        }`}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ink-900 text-white">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3v14"></path>
            <path d="M5 10l7-7 7 7"></path>
            <path d="M5 21h14"></path>
          </svg>
        </div>
        <h2 className="mt-4 text-lg font-medium text-ink-950">
          Upload a broker positions export
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          Drag an .xlsx or .csv file here, or click to browse.
        </p>
        <p className="mt-1 text-xs text-ink-400">
          Nothing is uploaded to a server. Parsing runs locally in your browser.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="rounded-md bg-ink-950 px-4 py-2 text-sm font-medium text-white hover:bg-ink-900 disabled:opacity-50"
          >
            {busy ? "Parsing..." : "Choose file"}
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              const res = await fetch("/sample-portfolio.xlsx");
              const blob = await res.blob();
              const file = new File([blob], "sample-portfolio.xlsx", {
                type: blob.type,
              });
              onFile(file);
            }}
            className="rounded-md border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:border-ink-400 disabled:opacity-50"
          >
            Try sample data
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        {error && (
          <p className="mt-4 text-sm text-red-600">{error}</p>
        )}
      </div>

      <div className="rounded-xl border border-ink-200 bg-white p-6 shadow-card">
        <h3 className="font-medium text-ink-950">What this tool does</h3>
        <ol className="mt-3 space-y-2 text-sm text-ink-600 list-decimal pl-5">
          <li>
            Reshapes a flat symbol-level export into a household view organized
            by asset class and account.
          </li>
          <li>
            Lets you edit a target allocation across asset classes and set a
            liquidity preference per account.
          </li>
          <li>
            Computes exact buy/sell trades for each account, respecting the
            constraint that cash cannot move between accounts.
          </li>
        </ol>
        <div className="mt-5 rounded-md bg-ink-50 border border-ink-200 p-3 text-xs text-ink-500">
          Expected columns: <code>Account Number</code>, <code>Account Name</code>,
          <code> Symbol</code>, <code>Description</code>, <code>Quantity</code>,
          <code> Last Price</code>, <code>Current Value</code>. The order does
          not matter and unknown columns are ignored.
        </div>
      </div>
    </div>
  );
}
