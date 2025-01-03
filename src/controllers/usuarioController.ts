
import { Request, Response } from 'express';
import client from '../db/turso'; // Ajusta la ruta según tu configuración

// Obtener detalles del usuario logueado
export const obtenerUsuarioLogueado = async (req: Request, res: Response): Promise<void> => {
    const userId = (req as any).user?.id; // Obtener el ID del usuario desde el middleware

    if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
    }

    try {
        const resultSet = await client.execute({
            sql: `SELECT 
                    u.id, 
                    u.nombre_usuario, 
                    u.correo, 
                    u.nombre, 
                    u.apellido,
                    r.nombre_rol AS rol_nombre, 
                    u.fecha_creacion 
                  FROM usuarios u
                  JOIN roles r ON u.role_id = r.id
                  WHERE u.id = ?`,
            args: [userId]
        });

        if (Array.isArray(resultSet.rows) && resultSet.rows.length > 0) {
            const user = resultSet.rows[0];
            res.status(200).json({
                id: user.id,
                nombre_usuario: user.nombre_usuario,
                correo: user.correo,
                nombre: user.nombre,
                apellido: user.apellido,
                rol_nombre: user.rol_nombre, // Incluye el nombre del rol en la respuesta
                fecha_creacion: user.fecha_creacion
            });
        } else {
            res.status(404).json({ error: 'Usuario no encontrado' });
        }
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Error al obtener el usuario' });
    }
};
