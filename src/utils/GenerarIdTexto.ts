// Objeto para almacenar el contador de cada tabla
const tableCounters: Record<string, number> = {};

// Función para generar un ID único basado en el nombre de la tabla
export const generateId = (tableName: string): string => {
    // Inicializamos el contador si la tabla no existe
    if (!tableCounters[tableName]) {
        tableCounters[tableName] = 1;
    }

    // Obtenemos el contador actual y generamos el ID
    const currentId = tableCounters[tableName];
    const formattedNumber = currentId.toString().padStart(6, '0');
    const id = `${tableName}-${formattedNumber}`;

    // Incrementamos el contador para la tabla
    tableCounters[tableName]++;

    return id;
};

// Ejemplo de uso
console.log(generateId("variante")); // variante-000001
console.log(generateId("producto")); // producto-000001
console.log(generateId("variante")); // variante-000002
