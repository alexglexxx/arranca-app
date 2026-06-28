// El elemento de firma del diseño: un medidor circular tipo tablero de auto.
// El ángulo de la aguja y el color cambian según el estado del préstamo,
// reutilizando la metáfora del medidor de gasolina en todo el flujo.

type EstadoGauge = 'revisando' | 'activo' | 'pagado';

interface GaugeProps {
  estado: EstadoGauge;
  montoCentral?: string;
  etiqueta?: string;
}

const ANGULOS: Record<EstadoGauge, { x: number; y: number; color: string }> = {
  revisando: { x: 55, y: 48, color: '#F4A623' },
  activo: { x: 135, y: 45, color: '#F4A623' },
  pagado: { x: 178, y: 100, color: '#3DD68C' },
};

const ARCOS: Record<EstadoGauge, string> = {
  revisando: 'M 15 110 A 85 85 0 0 1 100 25',
  activo: 'M 15 110 A 85 85 0 0 1 130 32',
  pagado: 'M 15 110 A 85 85 0 0 1 185 110',
};

export default function Gauge({ estado, montoCentral, etiqueta }: GaugeProps) {
  const { x, y, color } = ANGULOS[estado];
  const arco = ARCOS[estado];

  return (
    <div className="flex flex-col items-center my-2">
      <div className="relative w-[200px] h-[120px]">
        <svg viewBox="0 0 200 120" className="w-full h-full">
          <path
            d="M 15 110 A 85 85 0 0 1 185 110"
            fill="none"
            stroke="#232C37"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path
            d={arco}
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeLinecap="round"
          />
          <line
            x1="100"
            y1="110"
            x2={x}
            y2={y}
            stroke="#E8EBEF"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="100" cy="110" r="6" fill="#E8EBEF" />
        </svg>
        <div className="absolute bottom-1.5 left-0 right-0 text-center">
          {montoCentral && (
            <div
              className="font-mono text-3xl font-bold"
              style={{ color: estado === 'pagado' ? '#3DD68C' : undefined }}
            >
              {montoCentral}
            </div>
          )}
          {etiqueta && (
            <div className="text-xs text-textDim mt-1 uppercase tracking-wider font-semibold">
              {etiqueta}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
