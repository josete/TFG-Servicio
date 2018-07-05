module.exports = function (schema) {
    var Bloque = schema.define('Bloque', {
        id: schema.Number,
        nombre: schema.String,
        Juego_id:schema.Number
    }, {
            primaryKeys: ["id"]
        });
    
    Bloque.validatesPresenceOf('nombre',"Juego_id");    
    return Bloque;
};
