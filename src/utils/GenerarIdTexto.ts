// Objeto para almacenar el contador de cada tabla y los IDs generados
const tableCounters: Record<string, number> = {};
const generatedIds: Record<string, Set<string>> = {};

// Función para generar un ID único basado en el nombre de la tabla
export const generateId = (tableName: string): string => {
    // Inicializamos el contador y el conjunto de IDs si la tabla no existe
    if (!tableCounters[tableName]) {
        tableCounters[tableName] = 1;
        generatedIds[tableName] = new Set();
    }

    let id: string = "";  // Inicializamos id con un valor vacío
    let isUnique = false;

    // Buscamos un ID único que no esté en el conjunto de generados
    while (!isUnique) {
        const currentId = tableCounters[tableName];
        const formattedNumber = currentId.toString().padStart(6, '0');
        id = `${tableName}-${formattedNumber}`;

        // Comprobamos si el ID ya existe
        if (!generatedIds[tableName].has(id)) {
            isUnique = true; // Encontramos un ID único
            generatedIds[tableName].add(id); // Añadimos el ID al conjunto de generados
        }

        // Incrementamos el contador de la tabla
        tableCounters[tableName]++;
    }

    return id;
};
