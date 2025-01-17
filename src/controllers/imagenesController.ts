import client from "../db/turso";
import { Request, Response } from 'express';
import { DeleteObjectCommand } from '@aws-sdk/client-s3'; // Para eliminar objetos de R2
import { r2Client } from "../utils/r2"; // Cliente de R2 para interacción con el bucket
import { subiryConvetirR2 } from "../services/r2Service";


// Función para borrar una imagen de R2
const deleteImageFromR2 = async (imageUrl: string): Promise<void> => {
  const fileKey = imageUrl.split(`${process.env.R2_URLPUBLIC}/`)[1];
  if (fileKey) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: fileKey,
      });
      await r2Client.send(command); // Enviar la solicitud para eliminar la imagen de R2
    } catch (deleteError) {
      console.error(`Error al eliminar la imagen del bucket R2 (${fileKey}):`, deleteError);
    }
  }
};

export const modificarImagenesProducto = async (req: Request, res: Response): Promise<void> => {
    const productoSlug = req.params.slug; // Usamos el slug en lugar del id
    const { accion, descripcion } = req.body; // Datos enviados para crear o eliminar la imagen
  
    const file = req.files && typeof req.files === 'object' && 'file' in req.files
    ? (req.files['file'] as Express.Multer.File[])[0]
    : undefined; 
      
    try {
      // Validar que el producto exista usando el slug
      const producto = await client.execute({
        sql: "SELECT id FROM productos WHERE slug = ?",
        args: [productoSlug],
      });
  
      if (!producto.rows || producto.rows.length === 0) {
        res.status(404).json({ error: "El producto no existe" });
        return;
      }
  
      const productoId = producto.rows[0].id; // Obtenemos el id del producto usando el slug
  
      if (accion === "crear") {
        // Verificar si el archivo fue enviado
        if (!file) {
            res.status(400).json({ error: "No se proporcionó ninguna imagen." });
            return;
          }
    
          // Subir la imagen a R2
        const imageUrl = await subiryConvetirR2(file, 'productos'); // Subir la imagen y obtener la URL
    
  
        // Insertar la URL de la imagen en la base de datos
        await client.execute({
          sql: `INSERT INTO imagenes_productos (producto_id, url_imagen, descripcion)
                VALUES (?, ?, ?)`,
          args: [productoId, imageUrl, descripcion || null],
        });
  
        res.status(200).json({ message: "Imagen agregada exitosamente al producto" });
  
      } else if (accion === "eliminar") {
        // Eliminar imagen
        const { url_imagen } = req.body; // URL de la imagen a eliminar
  
        if (!url_imagen) {
          res.status(400).json({ error: "La URL de la imagen es obligatoria para eliminarla" });
          return;
        }
  
        // Eliminar la imagen del producto en la base de datos
        const result = await client.execute({
          sql: `DELETE FROM imagenes_productos WHERE producto_id = ? AND url_imagen = ?`,
          args: [productoId, url_imagen],
        });
  
        if (result.rowsAffected === 0) {
          res.status(404).json({ error: "Imagen no encontrada en el producto" });
          return;
        }
  
        // Borrar la imagen de R2
        await deleteImageFromR2(url_imagen);
  
        res.status(200).json({ message: "Imagen eliminada exitosamente del producto y de R2" });
  
      } else {
        res.status(400).json({ error: "Acción no válida. Debe ser 'crear' o 'eliminar'" });
      }
    } catch (error) {
      console.error("Error al modificar las imágenes del producto:", error);
      res.status(500).json({ error: "Error al modificar las imágenes del producto" });
    }
  };