// utils/dbValidations.ts

import { AppError } from "../utils/appError";
import { executeQuery } from "./dbService";

export const verificarExisteEnDb = async (
    tabla: string,
    columna: string,
    valor: any,
    mensajeError: string
) => {
    const query = `SELECT * FROM ${tabla} WHERE ${columna} = ?`;
    const resultado = await executeQuery(query, [valor]);

    if (resultado.rows.length > 0) {
        throw new AppError(mensajeError, 400);
    }
};
