import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid'; 
import client from '../db/turso';

// Crear detalles para un producto
export const crearDetalles = async (req: Request, res: Response): Promise<void> => {
    try {
        const productoId = req.params.id;
        const detallesString = req.body.detalles; // Suponiendo que los detalles vienen en el cuerpo de la solicitud

        // Validar si se han proporcionado detalles
        if (!detallesString) {
            res.status(400).json({ error: 'Debes proporcionar detalles.' });
            return;
        }

        let detalles = [];
        try {
            detalles = JSON.parse(detallesString);  // Convertir el string a JSON
        } catch (error) {
            res.status(400).json({ error: 'El formato de los detalles no es válido.' });
            return;
        }

        if (!Array.isArray(detalles) || detalles.length === 0) {
            res.status(400).json({ error: 'Debes proporcionar al menos un detalle.' });
            return;
        }

        // Insertar detalles en la base de datos
        for (const detalle of detalles) {
            const detalleId = uuidv4();  // Generar un nuevo id para cada detalle
            await client.execute({
                sql: "INSERT INTO detalles_productos (id, producto_id, especificacion, valor) VALUES (?, ?, ?, ?)",
                args: [detalleId, productoId, detalle.especificacion, detalle.valor]
            });
        }

        res.status(201).json({ message: 'Detalles creados exitosamente' });
    } catch (error) {
        console.error('Error creando detalles:', error);
        res.status(500).json({ error: 'Error al crear los detalles del producto' });
    }
};

// Actualizar un detalle específico
export const actualizarDetalle = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { especificacion, valor } = req.body;

    try {
        if (!especificacion || valor === undefined) {
            res.status(400).json({ error: 'Especificación y valor son obligatorios.' });
            return;
        }

        const result = await client.execute({
            sql: `UPDATE detalles_productos
                  SET especificacion = ?, valor = ?
                  WHERE id = ?`,
            args: [especificacion, valor, id]
        });

        if (result.rowsAffected > 0) {
            res.status(200).json({ message: 'Detalle actualizado exitosamente' });
        } else {
            res.status(404).json({ error: 'Detalle no encontrado' });
        }
    } catch (error) {
        console.error('Error actualizando detalle:', error);
        res.status(500).json({ error: 'Error al actualizar el detalle' });
    }
};

// Eliminar un detalle específico
export const eliminarDetalle = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
        const result = await client.execute({
            sql: `DELETE FROM detalles_productos WHERE id = ?`,
            args: [id]
        });

        if (result.rowsAffected > 0) {
            res.status(200).json({ message: 'Detalle eliminado exitosamente' });
        } else {
            res.status(404).json({ error: 'Detalle no encontrado' });
        }
    } catch (error) {
        console.error('Error eliminando detalle:', error);
        res.status(500).json({ error: 'Error al eliminar el detalle' });
    }
};
