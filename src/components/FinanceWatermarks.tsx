import { TrendingUp, PieChart, BarChart3, Wallet, Landmark, Calculator, Coins, Receipt, CreditCard, DollarSign, ArrowUpRight } from 'lucide-react';

const CURRENCY_SYMBOLS = [
  { symbol: '$', top: '8%', left: '5%', size: '2.5rem', delay: '0s', dur: '18s', opacity: 0.06 },
  { symbol: '€', top: '18%', left: '82%', size: '2rem', delay: '3s', dur: '22s', opacity: 0.05 },
  { symbol: '£', top: '72%', left: '8%', size: '2.2rem', delay: '6s', dur: '20s', opacity: 0.05 },
  { symbol: '₹', top: '60%', left: '88%', size: '2.8rem', delay: '1s', dur: '24s', opacity: 0.07 },
  { symbol: '¥', top: '38%', left: '3%', size: '1.8rem', delay: '8s', dur: '19s', opacity: 0.04 },
  { symbol: '$', top: '85%', left: '78%', size: '2rem', delay: '5s', dur: '21s', opacity: 0.05 },
  { symbol: '€', top: '45%', left: '92%', size: '1.6rem', delay: '10s', dur: '17s', opacity: 0.04 },
  { symbol: '₹', top: '15%', left: '45%', size: '1.4rem', delay: '7s', dur: '23s', opacity: 0.03 },
];

const ICON_ELEMENTS = [
  { Icon: TrendingUp, top: '12%', left: '78%', size: 28, delay: '2s', dur: '20s', opacity: 0.06 },
  { Icon: PieChart, top: '75%', left: '15%', size: 24, delay: '4s', dur: '22s', opacity: 0.05 },
  { Icon: BarChart3, top: '30%', left: '90%', size: 26, delay: '0s', dur: '18s', opacity: 0.06 },
  { Icon: Wallet, top: '55%', left: '5%', size: 22, delay: '6s', dur: '24s', opacity: 0.04 },
  { Icon: Landmark, top: '88%', left: '45%', size: 30, delay: '3s', dur: '19s', opacity: 0.05 },
  { Icon: Calculator, top: '5%', left: '55%', size: 20, delay: '8s', dur: '21s', opacity: 0.04 },
  { Icon: Coins, top: '65%', left: '80%', size: 22, delay: '1s', dur: '23s', opacity: 0.05 },
  { Icon: Receipt, top: '42%', left: '12%', size: 20, delay: '5s', dur: '17s', opacity: 0.04 },
  { Icon: CreditCard, top: '22%', left: '35%', size: 18, delay: '9s', dur: '25s', opacity: 0.03 },
  { Icon: DollarSign, top: '80%', left: '60%', size: 24, delay: '7s', dur: '20s', opacity: 0.05 },
  { Icon: ArrowUpRight, top: '50%', left: '70%', size: 18, delay: '11s', dur: '16s', opacity: 0.03 },
];

export default function FinanceWatermarks() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden="true">
      {/* Currency symbols */}
      {CURRENCY_SYMBOLS.map((c, i) => (
        <span
          key={`cur-${i}`}
          className="absolute font-bold text-white"
          style={{
            top: c.top,
            left: c.left,
            fontSize: c.size,
            opacity: c.opacity,
            animation: `float-slow ${c.dur} ease-in-out infinite`,
            animationDelay: c.delay,
          }}
        >
          {c.symbol}
        </span>
      ))}

      {/* Finance icons */}
      {ICON_ELEMENTS.map((el, i) => (
        <div
          key={`icon-${i}`}
          className="absolute text-white"
          style={{
            top: el.top,
            left: el.left,
            opacity: el.opacity,
            animation: `drift ${el.dur} ease-in-out infinite`,
            animationDelay: el.delay,
          }}
        >
          <el.Icon size={el.size} strokeWidth={1.5} />
        </div>
      ))}

      {/* Abstract chart bars - bottom left */}
      <div className="absolute bottom-[12%] left-[25%] flex items-end gap-[3px]" style={{ opacity: 0.05 }}>
        {[40, 65, 50, 80, 55, 72, 90, 60].map((h, i) => (
          <div
            key={`bar-${i}`}
            className="w-[4px] rounded-t-sm bg-white"
            style={{
              height: `${h * 0.5}px`,
              animation: `shimmer 3s ease-in-out infinite`,
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
      </div>

      {/* Abstract line chart - top right */}
      <svg className="absolute top-[20%] right-[20%]" width="120" height="60" viewBox="0 0 120 60" style={{ opacity: 0.04 }}>
        <polyline
          points="0,50 15,42 30,48 45,30 60,35 75,20 90,25 105,10 120,15"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="105" cy="10" r="3" fill="white" opacity="0.6" />
      </svg>

      {/* Circular ring - coin shape */}
      <div
        className="absolute top-[68%] left-[72%] h-16 w-16 rounded-full border-2 border-white"
        style={{ opacity: 0.03, animation: 'spin-slow 30s linear infinite' }}
      />
      <div
        className="absolute top-[25%] left-[15%] h-10 w-10 rounded-full border border-white"
        style={{ opacity: 0.03, animation: 'spin-slow 25s linear infinite reverse' }}
      />
    </div>
  );
}
