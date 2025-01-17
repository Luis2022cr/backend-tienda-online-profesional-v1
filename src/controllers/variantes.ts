import client from "../db/turso";
import { Request, Response } from 'express';
import { v4 as uuidv4 } from "uuid";
import { generateId } from "../utils/GenerarIdTexto";

export const modificarVariantesProducto = async (req: Request, res: Response): Promise<void> => {
    const productoSlug = req.params.slug;  // Usamos el slug en lugar del id
    const { id, valor, precio, stock, accion, variante_codigo } = req.body;  // Datos de la variante en el cuerpo de la solicitud

    try {
        // Validar que el producto exista usando el slug
        const producto = await client.execute({
            sql: "SELECT id FROM productos WHERE slug = ?",
            args: [productoSlug],
        });

        if (!producto.rows || producto.rows.length === 0) {
            res.status(404).json({ error: "El producto no existe" });
        }

        const productoId = producto.rows[0].id;  // Obtenemos el id del producto usando el slug

        // Validar que se haya enviado un ID de variante y una acción
        if (!id || !accion) {
            res.status(400).json({ error: "Se requiere el ID de la variante y la acción (crear, actualizar o eliminar)" });
        }

        // Ejecutar la acción basada en la solicitud
        if (accion === "crear") {
            // Validar que los campos necesarios estén presentes
            const id_nuevo = generateId('det-var'); // Generar un ID único para la variante
            

            if (!valor || !precio || !stock) {
                res.status(400).json({ error: "Datos incompletos para crear una variante" });
            }

            // Insertar nueva variante en la tabla
            await client.execute({
                sql: `
                    INSERT INTO detalles_variantes (id, producto_id, variante_id, valor, precio, stock, variante_codigo) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
                args: [id_nuevo, productoId, id, valor, precio, stock, variante_codigo],
            });

        } else if (accion === "actualizar") {
            // Actualizar variante existente
            if (!id) {
                res.status(400).json({ error: "Se requiere el ID de la variante para actualizarla" });
            }

            await client.execute({
                sql: `
                    UPDATE detalles_variantes 
                    SET valor = ?, precio = ?, stock = ? 
                    WHERE id = ? AND producto_id = ?
                `,
                args: [valor, precio, stock, id, productoId],
            });

        } else if (accion === "eliminar") {
            // Eliminar variante existente
            if (!id) {
                res.status(400).json({ error: "Se requiere el ID de la variante para eliminarla" });
            }

            await client.execute({
                sql: `
                    DELETE FROM detalles_variantes 
                    WHERE id = ? AND producto_id = ?
                `,
                args: [id, productoId],
            });

        } else {
            res.status(400).json({ error: "Acción no válida. Debe ser 'crear', 'actualizar' o 'eliminar'" });
        }

        // Enviar respuesta de éxito
        res.status(200).json({ message: "Variantes del producto modificadas exitosamente" });
    } catch (error) {
        console.error("Error al modificar las variantes del producto:", error);
        res.status(500).json({ error: "Error al modificar las variantes del producto" });
    }
};
