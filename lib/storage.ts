// Utilidad para subir archivos (selfies, videos, comprobantes) a Firebase
// Storage desde el navegador. Organiza los archivos por usuario y tipo para
// que sea fácil auditar manualmente desde la consola de Firebase si hace falta.

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export async function subirArchivo(
  archivo: File,
  carpeta: string,
  usuarioId: string
): Promise<string> {
  const timestamp = Date.now();
  const extension = archivo.name.split('.').pop() || 'bin';
  const ruta = `${carpeta}/${usuarioId}/${timestamp}.${extension}`;

  const storageRef = ref(storage, ruta);
  await uploadBytes(storageRef, archivo);

  return getDownloadURL(storageRef);
}
