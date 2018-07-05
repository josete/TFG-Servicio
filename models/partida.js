module.exports = function (schema) {
    var Partida = schema.define('Partida', {
        id: schema.Number,
        nombre: schema.String,
        id_juego: schema.Number
    }, {
            primaryKeys: ["id"]
        });
        Partida.validatesPresenceOf('nombre','id_juego');
    return Partida;
};
