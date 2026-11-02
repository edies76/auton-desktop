// Captura de bytes crudos para el diario de cambios.
// La reversión exacta necesita los bytes tal como estaban en disco, no el texto
// normalizado que devuelve la lectura: CRLF, finales mixtos y codificaciones no
// UTF-8 solo se restauran con los bytes originales.

import type { FileSystemPort } from "@zcode/contracts";

/**
 * Devuelve los bytes del archivo, `null` si no existe, o `undefined` si no se
 * pudieron capturar (el diario caerá al modo texto).
 */
export async function captureBytes(
  port: FileSystemPort,
  path: string,
): Promise<Buffer | null | undefined> {
  try {
    const result = await port.readBinaryFile({ path } as never);
    return Buffer.from(result.content);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "not_found") return null;
    return undefined;
  }
}
