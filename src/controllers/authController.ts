import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import client from '../db/turso';

const transporter = nodemailer.createTransport({
    service: 'gmail',  // Cambia 'hotmail' por 'Outlook' si tienes problemas
    auth: {
        user: process.env.OUTLOOK_USER,
        pass: process.env.OUTLOOK_PASSWORD
    }
});
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const register = async (req: Request, res: Response): Promise<void> => {
    const { nombre, apellido, correo, usuario, role_id, password, confirmPassword } = req.body;

    // Validar que todos los campos requeridos estén presentes
    if (!nombre || !apellido || !correo || !usuario || !role_id || !password || !confirmPassword) {
        res.status(400).json({ error: 'Todos los campos son requeridos' });
        return;
    }

    // Validar la longitud mínima de la contraseña
    if (password.length < 8) {
        res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
        return;
    }

    try {
        // Verificar si el correo ya existe
        if (password !== confirmPassword) {
            res.status(400).json({ error: 'Las contraseñas no coinciden' });
            return;
        }

        // Validar la seguridad de la contraseña

        if (!passwordRegex.test(password)) {
            res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres, incluyendo al menos una letra mayúscula, una letra minúscula, un número y un símbolo(@,$,!,%,*,?,&)' });
            return;
        }

        const checkEmail = await client.execute({
            sql: 'SELECT * FROM usuarios WHERE correo = ?',
            args: [correo]
        });

        if (checkEmail.rows.length > 0) {
            res.status(400).json({ error: 'El correo ya está registrado' });
            return;
        }

        // Verificar si el nombre de usuario ya existe
        const checkUsername = await client.execute({
            sql: 'SELECT * FROM usuarios WHERE usuario = ?',
            args: [usuario]
        });

        if (checkUsername.rows.length > 0) {
            res.status(400).json({ error: 'El nombre de usuario ya está en uso' });
            return;
        }

        // Encriptar la contraseña proporcionada por el usuario
        const hashedPassword = await bcrypt.hash(password, 10);

        // Guardar el usuario en la base de datos
        const id = crypto.randomUUID();
        await client.execute({
            sql: 'INSERT INTO usuarios (id, usuario, correo, password, nombre, apellido, role_id) VALUES ( ?, ?, ?, ?, ?, ?, ?)',
            args: [id, usuario, correo, hashedPassword, nombre, apellido, role_id]
        });

        // Contenido del correo de confirmación
        const emailContent = `
            <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
                    <div style="background-color: #0078d4; color: #ffffff; padding: 20px; text-align: center;">
                        <h1 style="margin: 0;">¡Registro exitoso en VOAE!</h1>
                    </div>
                    <div style="padding: 20px; color: #333333;">
                        <p>Hola ${nombre},</p>
                        <p>Te has registrado exitosamente en nuestro sistema con el nombre de usuario <strong>${usuario}</strong>.</p>
                        <p>Por favor, inicia sesión con las credenciales proporcionadas durante el registro.</p>
                        <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
                        <p>Gracias,</p>
                        <p>Equipo de soporte</p>
                    </div>
                </div>
            </div>
        `;

        try {
            await transporter.sendMail({
                from: process.env.OUTLOOK_USER,
                to: correo,
                subject: 'Confirmación de Registro en VOAE',
                html: emailContent
            });

            // Responder al cliente con un mensaje de éxito
            res.status(201).json({ message: 'Usuario registrado exitosamente y correo de confirmación enviado.' });
        } catch (emailError) {
            res.status(200).json({ error: 'Usuario registrado, pero ocurrió un error al enviar el correo de confirmación.' });
        }

    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: 'Error al registrar el usuario' });
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    const { usuario, password } = req.body;

    try {
        // Buscar el usuario en la base de datos
        const resultSet = await client.execute({
            sql: 'SELECT * FROM usuarios WHERE usuario = ?',
            args: [usuario]
        });

        if (Array.isArray(resultSet.rows) && resultSet.rows.length > 0) {
            const row = resultSet.rows[0];
            const user = {
                id: row[0] as string,
                usuario: row[1] as string,
                correo: row[2] as string,
                password: row[3] as string,
                nombre: row[4] as string,
                apellido: row[5] as string,
                role_id: row[6] as number,
            };

            // Comparar la contraseña proporcionada con la contraseña almacenada
            const isMatch = await bcrypt.compare(password, user.password);

            if (isMatch) {
                // Crear un token JWT
                const token = jwt.sign(
                    { id: user.id, usuario: user.usuario, role_id: user.role_id },
                    process.env.JWT_SECRET as string,
                    { expiresIn: '24h' }
                );

                // Devolver la respuesta con el token y los datos del usuario
                res.status(200).json({
                    token,
                    usuario: user.usuario,
                    role_id: user.role_id
                });
            } else {
                res.status(401).json({ error: 'Nombre de usuario o contraseña incorrectos' });
            }
        } else {
            res.status(401).json({ error: 'Nombre de usuario o contraseña incorrectos' });
        }
    } catch (error) {
        console.error('Error logging in user:', error);
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
};

export const generarCorreoRecuperacion = async (req: Request, res: Response): Promise<void> => {
    const { correo } = req.body;

    try {
        const resultSet = await client.execute({
            sql: 'SELECT * FROM usuarios WHERE correo = ?',
            args: [correo]
        });

        if (Array.isArray(resultSet.rows) && resultSet.rows.length > 0) {
            const user = resultSet.rows[0];
            const token = jwt.sign(
                { id: user[0], correo: user[2] },
                process.env.JWT_SECRET as string,
                { expiresIn: '1h' }
            );

            const resetLink = `https://proyecto-ingenieria.vercel.app/reset-password?token=${token}`;

            // Enviar el correo electrónico
            await transporter.sendMail({
                from: process.env.OUTLOOK_USER,
                to: correo,
                subject: 'Recuperación de contraseña',
                html: `
            <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
                    <div style="background-color: #0078d4; color: #ffffff; padding: 20px; text-align: center;">
                        <h1 style="margin: 0;">Restablecimiento de Contraseña</h1>
                    </div>
                    <div style="padding: 20px; color: #333333;">
                        <p>Hola,</p>
                        <p>Has solicitado restablecer tu contraseña. Haz clic en el siguiente enlace para establecer una nueva contraseña:</p>
                        <div style="text-align: center; margin: 20px 0;">
                            <a href="${resetLink}" style="background-color: #0078d4; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Restablecer Contraseña</a>
                        </div>
                        <p>Este enlace expirará en 1 hora.</p>
                        <p>Si no solicitaste este cambio, por favor, ignora este correo.</p>
                    </div>
                </div>
            </div>
            `
            });

            res.status(200).json({ message: 'Correo de recuperación enviado.' });
        } else {
            res.status(404).json({ error: 'El correo no está registrado' });
        }
    } catch (error) {
        console.error('Error generating recovery email:', error);
        res.status(500).json({ error: 'Error al generar el correo de recuperación' });
    }
};

export const cambiarContraseña = async (req: Request, res: Response): Promise<void> => {
    const { token, newPassword } = req.body;

    if (!passwordRegex.test(newPassword)) {
        res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres, incluyendo al menos una letra mayúscula, una letra minúscula, un número y un símbolo(@,$,!,%,*,?,&)' });
        return;
    }
    try {
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string, correo: string };

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await client.execute({
            sql: 'UPDATE usuarios SET password = ? WHERE id = ?',
            args: [hashedPassword, decodedToken.id]
        });

        res.status(200).json({ message: 'Contraseña actualizada exitosamente.' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Error al cambiar la contraseña' });
    }
};
