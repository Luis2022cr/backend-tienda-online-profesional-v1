import { AppError } from "./appError";

export const validacionesObligatorias = (fields: Record<string, any>, required: string[]) => {
    const missingFields = required.filter((field) => !fields[field]);
    if (missingFields.length) {
        throw new AppError(`Faltan estos datos: ${missingFields.join(', ')}`, 400);
    }
};

