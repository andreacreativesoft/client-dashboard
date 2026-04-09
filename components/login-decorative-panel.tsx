function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
      <ellipse cx="16" cy="16" rx="8" ry="14" stroke="currentColor" strokeWidth="2" />
      <path d="M2 16h28" stroke="currentColor" strokeWidth="2" />
      <path d="M4 8h24" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 24h24" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function FloatingCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`absolute ${className}`}>
      {/* Orange logo badge */}
      <div className="absolute -top-[53px] left-4 z-10 flex size-[72px] items-center justify-center overflow-hidden rounded-full border-8 border-[#DDE9E5] bg-[#F2612E]">
        <LogoIcon className="size-8 text-white" />
      </div>
      <div className="overflow-hidden rounded-[20px] bg-white shadow-[0px_25px_50px_0px_rgba(0,0,0,0.08)]">
        {children}
      </div>
    </div>
  );
}

function MiniBarChart() {
  const bars = [40, 65, 30, 80, 55, 70, 45];
  return (
    <div className="flex items-end gap-[6px] h-[80px]">
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-[12px] rounded-t-sm"
          style={{
            height: `${h}%`,
            backgroundColor: i === 3 ? "#2A5959" : "#E5E7EB",
          }}
        />
      ))}
    </div>
  );
}

function MiniDonutChart() {
  return (
    <div className="relative flex items-center justify-center size-[74px]">
      <svg viewBox="0 0 36 36" className="size-full -rotate-90">
        <circle
          cx="18"
          cy="18"
          r="14"
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="4"
        />
        <circle
          cx="18"
          cy="18"
          r="14"
          fill="none"
          stroke="#2A5959"
          strokeWidth="4"
          strokeDasharray="22 66"
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[11px] font-bold text-[#2E2E2E]">25%</span>
    </div>
  );
}

export function LoginDecorativePanel() {
  return (
    <div className="relative flex-1 items-center justify-center overflow-hidden bg-[#DDE9E5] max-lg:hidden lg:flex">
      {/* Decorative curved lines */}
      {/* Top: teal SVG curve */}
      <img
        src="/login/line-top.svg"
        alt=""
        className="pointer-events-none absolute -top-[100px] left-0 w-[140%]"
        style={{ transform: "rotate(-4deg)" }}
      />
      {/* Bottom: salmon/orange SVG curve */}
      <img
        src="/login/line-bottom.svg"
        alt=""
        className="pointer-events-none absolute -bottom-[50px] -left-[200px] w-[160%]"
      />

      {/* Card 1: Top-left — Profitability with bar chart */}
      <FloatingCard className="left-[60px] top-[120px] w-[222px]">
        <div className="px-6 py-5">
          <p className="text-[16px] font-bold uppercase leading-none text-[#2E2E2E]">
            Profitability
          </p>
          <p className="mt-1 text-[16px] font-bold uppercase leading-none text-[#2E2E2E]">
            $2,222.65
          </p>
          <div className="mt-3">
            <MiniBarChart />
          </div>
        </div>
      </FloatingCard>

      {/* Card 2: Center-right — Profitability with donut */}
      <FloatingCard className="right-[40px] top-1/2 w-[277px] -translate-y-1/2">
        <div className="px-6 pb-5 pt-6">
          <p className="text-[16px] font-bold uppercase leading-none text-[#2E2E2E]">
            Profitability
          </p>
          <div className="mt-3 flex justify-center">
            <MiniDonutChart />
          </div>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-[16px] font-bold uppercase leading-none text-[#F2612E]">+5.6%</span>
            <span className="text-[16px] font-bold uppercase leading-none text-black">
              Average indicator
            </span>
          </div>
        </div>
      </FloatingCard>

      {/* Card 3: Bottom-left — Marketing Digital */}
      <FloatingCard className="bottom-[80px] left-[100px] w-[240px]">
        <div className="px-6 pb-5 pt-7">
          <p className="text-[25px] font-bold uppercase leading-none tracking-[-0.75px] text-[#2E2E2E]">
            marketing digital
          </p>
          <p className="mt-2 text-[14px] leading-[1.5] text-[#6D6A65]">With real results</p>
          <div className="mt-4 flex items-end gap-2">
            <span className="text-[16px] font-bold uppercase leading-none text-[#F2612E]">+5.6%</span>
            <span className="text-[16px] font-bold uppercase leading-none text-black">
              Average indicator
            </span>
          </div>
        </div>
      </FloatingCard>
    </div>
  );
}
