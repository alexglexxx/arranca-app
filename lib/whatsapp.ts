// Cliente para WhatsApp Business API (Meta) — cuenta "Titan", número nuevo
// dedicado a este proyecto (ver pendiente técnico menor en ale-nota-proyecto-arranca.md).
//
// Uso actual: SOLO recordatorios de pago (tipo de plantilla UTILITY). El
// login/verificación de teléfono ahora lo maneja Firebase Auth directamente
// (ver app/registro y app/verificar), ya no pasa por WhatsApp.

const WHATSAPP_API_VERSION = 'v20.0';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID; // número nuevo dentro de Titan
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

interface ResultadoEnvioWhatsapp {
  exito: boolean;
  mensajeId?: string;
  error?: string;
}

export async function enviarRecordatorioPago(
  telefono: string,
  nombre: string,
  montoHoy: number,
  fechaLimite: string
): Promise<ResultadoEnvioWhatsapp> {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    throw new Error('WhatsApp no configurado.');
  }

  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  // Plantilla de tipo UTILITY — distinta a la de autenticación, también
  // necesita aprobación previa de Meta con el nombre "recordatorio_pago"
  const body = {
    messaging_product: 'whatsapp',
    to: telefono,
    type: 'template',
    template: {
      name: 'recordatorio_pago',
      language: { code: 'es_MX' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: nombre },
            { type: 'text', text: montoHoy.toString() },
            { type: 'text', text: fechaLimite },
          ],
        },
      ],
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return { exito: false, error: data?.error?.message };
    }

    return { exito: true, mensajeId: data?.messages?.[0]?.id };
  } catch (error) {
    return {
      exito: false,
      error: error instanceof Error ? error.message : 'Error de red',
    };
  }
}
