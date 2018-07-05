module.exports = function (schema) {
    var Pregunta = schema.define('Pregunta', {
        id: schema.Number,
        nivel: schema.Number,
        tipo: schema.String,
        enunciado: schema.String,
        imagen: schema.String,
        solucion: schema.String,
        correccion: schema.String,
        tiempo: schema.Number,
        pista: schema.String,
        resA: schema.String,
        resB: schema.String,
        resC: schema.String,
        resD: schema.String,
        Tema_id:schema.Number
    }, {
            primaryKeys: ["id"]
        });
    
    Pregunta.validatesPresenceOf('nivel','tipo','enunciado','solucion',"Tema_id");    
    return Pregunta;
};