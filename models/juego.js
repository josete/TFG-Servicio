module.exports = function (schema) {
    var Juego = schema.define('Juego', {
        id: schema.Number,
        nombre: schema.String,
        imagen: schema.String,
        id_usuario: schema.Number
    }, {
            primaryKeys: ["id"]
        });
        Juego.validatesPresenceOf('nombre','id_usuario');
    return Juego;
};
