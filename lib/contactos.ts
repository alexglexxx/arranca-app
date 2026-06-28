// Wrapper sobre la Contact Picker API del navegador. Soporte real: Chrome en
// Android desde v112. En iOS/Safari NO está disponible por defecto (requiere
// activar una bandera experimental que casi ningún usuario real activa), así
// que SIEMPRE hay que verificar soporte antes de mostrar el botón — si no,
// el campo de texto manual es el único camino, sin mostrar un botón roto.

interface ContactoSeleccionado {
  nombre: string;
  telefono: string;
}

// Tipos mínimos para la Contact Picker API — no está en los tipos estándar
// de TypeScript/DOM todavía, así que se declaran aquí de forma acotada.
interface ContactProperty {
  name?: string[];
  tel?: string[];
}

interface NavigatorWithContacts extends Navigator {
  contacts?: {
    select: (
      properties: string[],
      options?: { multiple?: boolean }
    ) => Promise<ContactProperty[]>;
  };
}

export function soportaContactPicker(): boolean {
  if (typeof navigator === 'undefined') return false;
  return 'contacts' in navigator && 'ContactsManager' in window;
}

export async function elegirContacto(): Promise<ContactoSeleccionado | null> {
  const nav = navigator as NavigatorWithContacts;

  if (!nav.contacts) return null;

  try {
    const resultados = await nav.contacts.select(['name', 'tel'], { multiple: false });

    if (!resultados || resultados.length === 0) return null;

    const contacto = resultados[0];
    const nombre = contacto.name?.[0] || '';
    const telefono = contacto.tel?.[0] || '';

    return { nombre, telefono };
  } catch {
    // El usuario canceló el selector, o el navegador rechazó el permiso —
    // en ambos casos, simplemente no se llena nada y se sigue con el
    // campo manual.
    return null;
  }
}
