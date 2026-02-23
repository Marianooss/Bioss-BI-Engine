// dataProcessing.worker.ts - Web Worker for heavy data processing
// This worker handles normalizeHeaders and chunk processing to prevent UI blocking

// Safe casting helper
const safeNum = (val: any) => Number(val) || 0;

// Mapping for column normalization
const mapping: Record<string, string[]> = {
  'Importe_Total': ['importe', 'total', 'facturacion', 'monto', 'neto', 'importe_total'],
  'Codigo_Cliente': ['codigo', 'id_cliente', 'cliente_id', 'cod_cli', 'codigo_cliente'],
  'Nombre_Cliente': ['nombre', 'razon_social', 'cliente', 'nombre_cliente', 'customer'],
  'Fecha': ['fecha', 'periodo', 'mes', 'dia', 'fecha_data', 'date'],
  'Provincia': ['provincia', 'jurisdiccion', 'zona', 'region', 'state'],
  'Sector': ['sector', 'unidad_negocio', 'un', 'division', 'segmento'],
  'Costo_Total': ['costo', 'costo_total', 'cost', 'total_cost'],
  'Cantidad': ['volumen', 'cantidad', 'qty', 'unidades', 'count'],
  'Determinacion': ['determinacion', 'analisis', 'estudio', 'prestacion', 'servicio']
};

// Worker message types
interface WorkerMessage {
  type: 'NORMALIZE_HEADERS' | 'PROCESS_CHUNK';
  data: any;
  chunkIndex?: number;
}

interface NormalizedHeadersMessage {
  type: 'HEADERS_NORMALIZED';
  normalizedRow: any;
  originalRow: any;
}

interface ChunkProcessedMessage {
  type: 'CHUNK_PROCESSED';
  transactions: any[];
  chunkIndex: number;
}

// Normalize headers function (moved from DataService)
function normalizeHeaders(rawRow: any): any {
  const normalizedRow: any = {};

  // Procesar cada columna de la fila original
  Object.keys(rawRow).forEach(key => {
    const cleanKey = key.toLowerCase().trim().replace(/ /g, '_');

    // Buscar si la columna actual coincide con algún sinónimo del mapa
    let found = false;
    for (const [targetKey, synonyms] of Object.entries(mapping)) {
      if (synonyms.includes(cleanKey) || cleanKey === targetKey.toLowerCase()) {
        normalizedRow[targetKey] = rawRow[key];
        found = true;
        break;
      }
    }

    // Si no está en el mapa, mantener el nombre original pero limpio
    if (!found) {
      normalizedRow[key] = rawRow[key];
    }
  });

  return normalizedRow;
}

// Process chunk function with chunking to avoid blocking
function processChunk(chunk: any[], chunkIndex: number): any[] {
  const transactions: any[] = [];
  const MICRO_CHUNK_SIZE = 1000; // Process in smaller micro-chunks

  // Process in micro-chunks to avoid blocking
  for (let i = 0; i < chunk.length; i += MICRO_CHUNK_SIZE) {
    const microChunk = chunk.slice(i, i + MICRO_CHUNK_SIZE);

    microChunk.forEach((row, rowIndex) => {
      if (!row) return;

      try {
        // Normalize the row (simplified version for worker)
        const normalizedRow = normalizeHeaders(row);

        // Create transaction object (simplified)
        const transaction = {
          Fecha_Mes: normalizedRow.Fecha || new Date().toISOString().split('T')[0],
          Fecha_Data: normalizedRow.Fecha || new Date().toISOString().split('T')[0],
          ID_Cliente: String(normalizedRow.Codigo_Cliente || `CLI-${chunkIndex * 10000 + i + rowIndex}`).trim(),
          Nombre_Cliente: String(normalizedRow.Nombre_Cliente || 'N/A').trim(),
          Provincia: String(normalizedRow.Provincia || 'SIN PROVINCIA').trim(),
          Codigo_Determinacion: String(normalizedRow.Determinacion || `DET-${chunkIndex * 10000 + i + rowIndex}`).trim(),
          Nombre_Determinacion: 'Determinación Genérica',
          Sector: 1,
          Sector_Medico: String(normalizedRow.Sector || 'General').trim(),
          Cantidad: safeNum(normalizedRow.Cantidad || 1),
          Costo_Total: safeNum(normalizedRow.Costo_Total || 0),
          Importe_Total: safeNum(normalizedRow.Importe_Total || 0),
        };

        transactions.push(transaction);
      } catch (e) {
        console.warn(`Worker: Error procesando fila ${i + rowIndex}:`, e);
      }
    });

    // Yield control briefly to prevent blocking (simulate async behavior)
    if (i + MICRO_CHUNK_SIZE < chunk.length) {
      // In a real async environment, this would be a setTimeout or similar
      // For now, we'll process synchronously but in smaller chunks
    }
  }

  return transactions;
}

// Handle messages from main thread
self.onmessage = function(e: MessageEvent<WorkerMessage>) {
  const message = e.data;

  switch (message.type) {
    case 'NORMALIZE_HEADERS':
      const normalized = normalizeHeaders(message.data);
      const response: NormalizedHeadersMessage = {
        type: 'HEADERS_NORMALIZED',
        normalizedRow: normalized,
        originalRow: message.data
      };
      self.postMessage(response);
      break;

    case 'PROCESS_CHUNK':
      const transactions = processChunk(message.data, message.chunkIndex || 0);
      const chunkResponse: ChunkProcessedMessage = {
        type: 'CHUNK_PROCESSED',
        transactions,
        chunkIndex: message.chunkIndex || 0
      };
      self.postMessage(chunkResponse);
      break;

    default:
      console.warn('Worker: Unknown message type:', message.type);
  }
};

// Export for TypeScript (not actually used in worker)
export {};
