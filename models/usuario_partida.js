module.exports = function (schema) {
    var Usuario_Partida = schema.define('Usuario_Partida', {
        id_usuario: schema.Number,
        id_partida: schema.Number
    }, {
            primaryKeys: ["id_usuario","id_partida"]
        });
    return Usuario_Partida;
};