// Componentes de UI base, fieles a los tokens definidos en tailwind.config.js
// y al prototipo HTML original. Se mantienen simples a propósito — este
// proyecto no necesita una librería de componentes completa.

import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function BrandHeader() {
  return (
    <div className="flex items-center gap-2.5 mb-8">
      <div className="w-[30px] h-[30px] rounded-lg bg-gradient-to-br from-amber to-amber shadow-[0_8px_22px_rgba(250,204,21,0.28)] flex items-center justify-center flex-shrink-0">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#1A1304" strokeWidth="2.4" strokeLinecap="round">
          <path d="M3 12h18M14 5l7 7-7 7" />
        </svg>
      </div>
      <div className="font-display font-semibold text-[22px] leading-none whitespace-nowrap text-on-dark text-soft-outline">
        arranca<span className="text-amber">.</span>
      </div>
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }) {
  const base =
    'w-full py-[18px] rounded-[18px] font-bold text-base transition disabled:opacity-70 disabled:saturate-50 active:scale-[0.98]';
  const variants = {
    primary: 'button-readable',
    ghost: 'bg-surface border border-border text-on-dark-muted mt-2.5 shadow-[0_10px_24px_rgba(0,0,0,0.22)]',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Field({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div className="mb-4">
      <label className="label-readable block text-[14.5px] mb-2 font-semibold">{label}</label>
      <input
        className="input-readable w-full rounded-[16px] px-4 py-[16px] text-base outline-none transition-colors"
        {...props}
      />
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`card-readable rounded-card p-[18px] mb-3.5 ${className}`}>
      {children}
    </div>
  );
}

export function CardRow({ label, value, valueClassName = '' }: { label: string; value: ReactNode; valueClassName?: string }) {
  return (
    <div className="flex justify-between items-baseline py-[9px] border-t border-border first:border-t-0">
      <span className="text-[14.5px] text-on-dark-muted">{label}</span>
      <span className={`text-[14.5px] font-semibold ${valueClassName}`}>{value}</span>
    </div>
  );
}

type EstadoPill = 'activo' | 'pagado' | 'pendiente' | 'mora';

const PILL_STYLES: Record<EstadoPill, string> = {
  activo: 'bg-amberDim text-amber',
  pagado: 'bg-greenDim text-green',
  pendiente: 'bg-surface2 text-on-dark-muted',
  mora: 'bg-[#33201D] text-danger',
};

const PILL_LABELS: Record<EstadoPill, string> = {
  activo: 'Activo',
  pagado: 'Pagado',
  pendiente: 'Pendiente',
  mora: 'Mora',
};

export function Pill({ estado }: { estado: EstadoPill }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-[11px] py-[5px] rounded-full text-xs font-semibold ${PILL_STYLES[estado]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {PILL_LABELS[estado]}
    </span>
  );
}

export function UploadBox({
  titulo,
  descripcion,
  completado = false,
  onClick,
}: {
  titulo: string;
  descripcion: string;
  completado?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full border-2 rounded-[18px] px-4 py-7 text-center mb-3.5 transition-colors ${
        completado
          ? 'border-solid border-green text-green bg-greenDim/30'
          : 'border-dashed border-border text-on-dark-muted bg-surface/50'
      }`}
    >
      {completado ? (
        <svg className="mx-auto mb-3" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg className="mx-auto mb-3 opacity-60" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <path d="M3 9l9 5 9-5" />
        </svg>
      )}
      <div className="text-sm">
        <strong className="block text-[15px] mb-0.5">{titulo}</strong>
        {descripcion}
      </div>
    </button>
  );
}
