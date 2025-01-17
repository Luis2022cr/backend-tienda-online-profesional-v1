// controllers/negocioController.ts
import { Request, Response } from 'express';
import { executeQuery } from '../services/dbService';
import { validacionesObligatorias } from '../utils/validaciones';
import { AppError } from '../utils/appError';
import { subiryConvetirR2 } from '../services/r2Service';

// Obtener todos los negocios (sin redes sociales)
export const getnegocios = async (req: Request, res: Response) => {
    try {
        const results = await executeQuery(`
            SELECT id, logo, nombre, descripcion
            FROM negocios
            ORDER BY id ASC;
        `);
        res.status(200).json(results.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener negocios' });
    }
};

// Obtener un negocio por ID (con todos los datos)
export const getnegocioPorId = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
        const resultados = await executeQuery(
            "SELECT * FROM negocios WHERE id = ?",
            [id]
        );

        if (resultados.rows.length > 0) {
            const negocio = resultados.rows[0];
            res.status(200).json({ negocio });
        } else {
            throw new AppError("Negocio no encontrado", 404);
        }
    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Error al obtener el negocio' });
        }
    }
};

// Obtener las redes sociales de un negocio por ID
export const getRedesSocialesNegocio = async (req: Request, res: Response): Promise<void> => {

    try {
        const resultados = await executeQuery(
            `
            SELECT facebook, instagram, twitter, correo, celular
            FROM negocios
            `
        );

        // const redesSociales = resultados.rows;
        // res.status(200).json({ redesSociales });
        res.status(200).json(resultados.rows);

    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Error al obtener las redes sociales del negocio' });
        }
    }
};

// Actualizar un negocio existente
export const actualizarnegocio = async (req: Request, res: Response): Promise<void> => {
    const negocioId = req.params.id;
    const { nombre, descripcion, facebook, instagram, twitter, celular, correo } = req.body;
    const file = req.files && typeof req.files === 'object' && 'file' in req.files
    ? (req.files['file'] as Express.Multer.File[])[0]
    : undefined; 
    try {
        // Validar los campos obligatorios
        validacionesObligatorias({ negocioId, nombre, descripcion, celular, correo }, ['negocioId', 'nombre', 'descripcion']);

        let imageUrl: string | undefined;

        // Subir y convertir la imagen (logo) si es proporcionada
        if (file) {
            imageUrl = await subiryConvetirR2(file, 'negocios');
        }

        // Crear objeto con los datos a actualizar, excluyendo la imagen si no está presente
        const datosActualizar: { [key: string]: string } = {
            nombre,
            descripcion,
            facebook,
            instagram,
            twitter,
            celular,
            correo
        };

        // Si se proporcionó una nueva imagen (logo), añadirla a los datos a actualizar
        if (imageUrl) {
            datosActualizar.logo = imageUrl;
        }

        // Actualizar los datos del negocio en la base de datos
        await executeQuery(
            `UPDATE negocios SET ${Object.keys(datosActualizar).map(key => `${key} = ?`).join(', ')} WHERE id = ?`,
            [...Object.values(datosActualizar), negocioId]
        );

        res.status(200).json({ message: 'Negocio actualizado exitosamente' });
    } catch (error) {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({ error: error.message });
        } else {
            res.status(500).json({ error: "Error al actualizar el negocio" });
        }
    }
};