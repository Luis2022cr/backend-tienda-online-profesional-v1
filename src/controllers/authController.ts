import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import client from '../db/turso';

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

        res.status(201).json({ message: 'Usuario registrado exitosamente' });

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
