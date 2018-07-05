module.exports = function (schema) {
    var Tema = schema.define('Tema', {
        id: schema.Number,
        nombre: schema.String,
        Bloque_id:schema.Number
    }, {
            primaryKeys: ["id"]
        });
    
    Tema.validatesPresenceOf('nombre',"Bloque_id");    
    return Tema;
};
