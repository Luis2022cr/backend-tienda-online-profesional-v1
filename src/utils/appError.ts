export class AppError extends Error {
    public statusCode: number;

    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;

        // Captura la traza del error sin afectar el constructor actual
        Error.captureStackTrace(this, this.constructor);
    }
}