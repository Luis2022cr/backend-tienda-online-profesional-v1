// Función para generar un slug a partir del nombre
export const generateSlug = (name: string): string => {
    return name
        .toLowerCase()
        .trim()
        .replace(/[\s\W-]+/g, '-');
};
