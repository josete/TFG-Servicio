module.exports = function (schema) {
    var progreso_partida = schema.define('progreso_partida', {
        id: schema.Number,
        id_partida: schema.Number,
        id_jugador: schema.Number,
        nivel: schema.Number,
        tipo: schema.String,
        id_tema: schema.Number,
        id_pregunta_anterior: schema.Number,
        terminado: schema.Number
    }, {
            primaryKeys: ["id"]
        });

    progreso_partida.validatesPresenceOf('id_partida', "id_jugador","nivel","tipo","id_tema","terminado");
    return progreso_partida;
};