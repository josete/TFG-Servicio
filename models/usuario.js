module.exports = function (schema) {
    var Usuario = schema.define('Usuario', {
        id: schema.Number,
        nombre: schema.String,
        email: schema.String,
        password: schema.String,
        nivel: schema.Number,
        expActual: schema.Number,
        expSiguiente: schema.Number
    }, {
            primaryKyes: ["id"]
        });
    Usuario.validatesPresenceOf('nombre', 'email', 'password');
    Usuario.validatesUniquenessOf('email', { message: 'El email ya esta en uso' });
    Usuario.validatesUniquenessOf('nombre', { message: 'El nombre ya esta en uso' });
    return Usuario;
};
