var crypto = require('crypto');
var caminte = require('caminte'),
    Schema = caminte.Schema,
    config = {
        driver: "mysql",    // or mariadb
        host: "localhost",
        port: "3306",
        username: "root",
        password: "root",
        database: "tfg",
        pool: true // optional for use pool directly
    };
var path = require("path");
var express = require('express');
var bodyParser = require("body-parser");
var jwt = require('jsonwebtoken');
var formidable = require('formidable');
var fs = require("fs");
var async = require("async");

var schema = new Schema(config.driver, config);
var UsuarioModel = require("./models/usuario.js");
var JuegoModel = require("./models/juego.js");
var BloqueModel = require("./models/bloque.js");
var TemaModel = require("./models/tema.js");
var PreguntaModel = require("./models/pregunta.js");
var PartidaModel = require("./models/partida.js");
var Usuario_PartidaModel = require("./models/usuario_partida.js");
var Progreso_PartidaModel = require("./models/progreso_partida.js");
var Usuario = new UsuarioModel(schema);
var Juego = new JuegoModel(schema);
var Bloque = new BloqueModel(schema);
var Tema = new TemaModel(schema);
var Pregunta = new PreguntaModel(schema);
var Partida = new PartidaModel(schema);
var Usuario_Partida = new Usuario_PartidaModel(schema);
var Progreso_Partida = new Progreso_PartidaModel(schema);


var app = express();
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json());

var salt = "SuperSalt";
var algorithm = 'aes-256-ctr';

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    next();
});

app.post("/usuario", function (req, res, next) {
    encryptPassword(req.body.password, function (cifrado) {
        var u = new Usuario({
            nombre: req.body.nombre, email: req.body.email, password: cifrado, nivel: 1,
            expActual: 0, expSiguiente: 100
        });
        u.isValid(function (valid) {
            if (!valid) {
                if (u.errors["email"] != undefined) {
                    res.send({ "err": u.errors["email"][0] });
                } else if (u.errors["nombre"] != undefined) {
                    res.send({ "err": u.errors["nombre"][0] });
                }
                console.log(u.errors); // hash of errors {attr: [errmessage, errmessage, ...], attr: ...}
            } else {
                u.save(function (err) {
                    if (err) {
                        res.send({ "err": "Ha ocurrido un error" });
                    } else {
                        res.send({ "ok": "Usuario registrado con exito" });
                    }
                });
            }
        });
    });
});

app.post("/usuario/login", function (req, res, next) {
    var Query = Usuario.findOne();
    Query.where("email", req.body.email);
    Query.run({}, function (err, usuario) {
        if (usuario == undefined) {
            res.json({ "msg": "email o contraseña incorrectos" });
        } else {
            encryptPassword(req.body.password, function (cifrado) {
                if (usuario.password == cifrado) {
                    var token = jwt.sign({ id: usuario.id, nombre: usuario.nombre, email: usuario.email, expActual: usuario.expActual, expSiguiente: usuario.expSiguiente }, 'shhhhh', { expiresIn: '7d' });
                    res.send({ "token": token });
                } else {
                    res.send({ "msg": "email o contraseña incorrectos" });
                }
            });
        }
    });
});

app.post("/comprobarToken", function (req, res, next) {
    token = req.body.token;
    jwt.verify(token, 'shhhhh', function (err, dec) {
        if (dec != undefined) {
            res.send(true);
        } else {
            res.send(false);
        }
    });
});

app.post("/juego", function (req, res, next) {
    var idUsuario = jwt.decode(req.header("Authorization"), 'shhhhh').id;
    var c = new Juego({ nombre: req.body.nombre, id_usuario: idUsuario });
    c.isValid(function (valid) {
        if (!valid) {
            console.log(c.errors); // hash of errors {attr: [errmessage, errmessage, ...], attr: ...}
        } else {
            c.save(function (err) {
                if (err) {
                    console.log("Error!!!");
                } else {
                    console.log("Juego insertado con exito!!");
                    res.send({ "id": c.id });
                }
            });
        }
    });
});
app.post("/imagen/juego/:id", function (req, res, next) {
    var form = new formidable.IncomingForm();
    function getPath(req, callback) {
        form.parse(req, function (err, fields, files) {
            var oldpath = files.imagen.path;
            var extensionPartes = files.imagen.name.split(".");
            var extension = extensionPartes[extensionPartes.length - 1];
            //var newpath = './imagenes/juegos/' + +"."+extension;
            callback(oldpath, extension);
        });
    }
    getPath(req, function (oldpath, extension) {
        var newpath = './imagenes/juegos/' + req.params.id + "." + extension;
        fs.rename(oldpath, newpath, function (err) {
            if (err) throw err;
            Juego.update({ where: { id: req.params.id } }, { imagen: req.params.id + "." + extension }, function (err, imagen) { });
        });
    });
});
app.delete("/juego/:id", function (req, res, next) {
    var idUsuario = jwt.decode(req.header("Authorization"), 'shhhhh').id;
    var Query = Juego.all({ where: { id: req.params.id } }, function (err, juego) {
        if (juego[0].id_usuario == idUsuario) {
            async.waterfall([function (callback) {
                Partida.all({ where: { id_juego: req.params.id } }, function (err, partidas) {
                    if (partidas.length == 0) {
                        callback(null, partidas);
                    }
                    for (var i = 0; i < partidas.length; i++) {
                        Usuario_Partida.remove({ where: { id_partida: partidas[i].id } }, function (err) {
                            if (!err) {
                                console.log("Partidas usuario borradas");
                                callback(null, partidas);
                            }
                        });
                    }
                });
            }, function (partidas, callback) {
                if (partidas.length == 0) {
                    callback(null);
                }
                for (var i = 0; i < partidas.length; i++) {
                    Partida.remove({ where: { id: partidas[i].id } }, function (err) {
                        if (!err) {
                            console.log("Partidas borradas");
                            callback();
                        }
                    });
                }
            }, function (callback) {
                Bloque.all({ where: { Juego_id: req.params.id } }, function (err, bloques) {
                    var i = 0;
                    var t = [];
                    async.during(function (callback) {
                        return callback(null, i < bloques.length);
                    }, function (callback) {
                        Tema.all({ where: { Bloque_id: bloques[i].id } }, function (err, temas) {
                            var j = 0;
                            t.push(temas);
                            async.during(function (callback) {
                                return callback(null, j < temas.length);
                            }, function (callback) {
                                Pregunta.remove({ where: { Tema_id: temas[j].id } }, function (err) {
                                    if (!err) {
                                        j++;
                                        callback(null);
                                    }
                                });
                            }, function (err) {
                                i++;
                                callback(null);
                            });
                        });
                    }, function (err) {
                        console.log("Preguntas borradas");
                        callback(null, t);
                    });
                });
            }, function (temas, callback) {
                var i = 0;
                async.during(function (callback) {
                    return callback(null, i < temas.length);
                }, function (callback) {
                    var j = 0;
                    for (j = 0; j < temas[i].length; j++) {
                        Tema.remove({ where: { id: temas[i][j].id } }, function (err) {

                        });
                    }
                    if (j == temas[i].length) {
                        i++;
                        callback();
                    }
                }, function (err) {
                    console.log("Temas borrados"),
                        callback(null);
                });
            }, function (callback) {
                Bloque.remove({ where: { Juego_id: req.params.id } }, function (err) {
                    if (!err) {
                        console.log("Bloques borrados");
                        callback(null);
                    }
                });
            }, function (callback) {
                Juego.remove({ where: { id: req.params.id } }, function (err) {
                    if (!err) {
                        console.log("Juego eliminado");
                        callback(null, null);
                    }
                });
            }], function (err, result) {
                res.json({ "msg": "Juego eliminado" });
            });
        }
    });;
});

app.put("/juego/:id", function (req, res, next) {
    var idUsuario = jwt.decode(req.header("Authorization"), 'shhhhh').id;
    var Query = Juego.all({ where: { id: req.params.id } }, function (err, juego) {
        if (juego[0].id_usuario == idUsuario) {
            console.log(req.body.nombre);
            Juego.update({ where: { id: req.params.id } }, { nombre: req.body.nombre }, function (err, imagen) {
                if (!err) {
                    res.json({ "ok": "Juego actualizado correctamente" });
                }
            });
        }
    });
});

app.get("/juego", function (req, res, next) {
    var Query = Juego.all();
    Query.run({}, function (err, Juegos) {
        var JuegosObjeto = {};
        JuegosObjeto.Juegos = Juegos;
        res.json(JuegosObjeto);
    });
});
app.get("/juego/recientes", function (req, res, next) {
    var Query = Juego.all();
    Query.sort('id', 'DESC');
    Query.run({}, function (err, Juegos) {
        var JuegosObjeto = {};
        var juegosRecientes = [];
        for (var i = 0; i < 4; i++) {
            if (Juegos[i] != undefined) {
                juegosRecientes.push(Juegos[i]);
            }
        }
        JuegosObjeto.Juegos = juegosRecientes;
        res.json(JuegosObjeto);
    });
});
app.get("/juego/:idUsuario", function (req, res, next) {
    var Query = Juego.all();
    Query.where("id_usuario", req.params.idUsuario);
    Query.run({}, function (err, Juegos) {
        var JuegosObjeto = {};
        JuegosObjeto.Juegos = Juegos;
        //console.log(JuegosObjeto);
        res.json(JuegosObjeto);
    });
});
app.get("/juego/busqueda/:nombre", function (req, res, next) {
    var Query = Juego.all();
    Query.run({}, function (err, Juegos) {
        var JuegosObjeto = {};
        var JuegosValidos = [];
        for (i = 0; i < Juegos.length; i++) {
            if (Juegos[i].nombre.toLowerCase().includes(req.params.nombre.toLowerCase())) {
                JuegosValidos.push(Juegos[i]);
            }
        }
        JuegosObjeto.Juegos = JuegosValidos;
        res.json(JuegosObjeto);
    });
});
app.get("/imagen/juego/:nombre", function (req, res, next) {
    fs.readFile("./imagenes/juegos/" + req.params.nombre, function (err, content) {
        if (err) {
            fs.readFile("./imagenes/noImagen.png", function (err, content) {
                res.writeHead(200, { 'Content-type': 'image/jpg' });
                res.end(content);
            });
        } else {
            res.writeHead(200, { 'Content-type': 'image/jpg' });
            res.end(content);
        }
    });
});

app.post("/juego/bloque", function (req, res, next) {
    console.log(" ---- " + req.body.nombre);
    var b = new Bloque({ nombre: req.body.nombre, Juego_id: req.body.idJuego });
    b.isValid(function (valid) {
        if (!valid) {
            console.log(b.errors); // hash of errors {attr: [errmessage, errmessage, ...], attr: ...}
        } else {
            b.save(function (err) {
                if (err) {
                    console.log("Error!!!");
                } else {
                    console.log("Bloque insertado con exito!!");
                    res.send({ "id": b.id });
                }
            });
        }
    });
});

app.put("/juego/:idJuego/bloque/:idBloque", function (req, res, next) {
    var idUsuario = jwt.decode(req.header("Authorization"), 'shhhhh').id;
    var Query = Juego.all({ where: { id: req.params.idJuego } }, function (err, juego) {
        if (juego[0].id_usuario == idUsuario) {
            Bloque.update({ where: { id: req.params.idBloque } }, { nombre: req.body.nombre }, function (err, imagen) { });
            var temas = req.body.nuevosTemas;
            var i = 0;
            if (temas != undefined) {
                async.during(function (callback) {
                    return callback(null, i < temas.length);
                }, function (callback) {
                    var t = new Tema({ nombre: temas[i].nombre, Bloque_id: req.params.idBloque });
                    t.isValid(function (valid) {
                        if (valid) {
                            t.save(function (err) {
                                if (!err) {
                                    i++;
                                    callback();
                                }
                            });
                        }
                    });
                }, function (err) {
                    res.json({ "ok": "Bloque actualizado" });
                });
            } else {
                res.json({ "ok": "Bloque actualizado" });
            }
        }
    });
});

app.get("/juego/:idJuego/bloque", function (req, res, next) {
    var Query = Bloque.all();
    Query.where("Juego_id", req.params.idJuego);
    Query.run({}, function (err, bloques) {
        var bloquesObjeto = {};
        bloquesObjeto.bloques = bloques;
        console.log(bloquesObjeto.bloques);
        res.json(bloquesObjeto);
    });
});
app.post("/juego/bloque/tema", function (req, res, next) {
    console.log(req.body.idBloque + " ---- " + req.body.nombre);
    var t = new Tema({ nombre: req.body.nombre, Bloque_id: req.body.idBloque });
    t.isValid(function (valid) {
        if (!valid) {
            console.log(t.errors); // hash of errors {attr: [errmessage, errmessage, ...], attr: ...}
        } else {
            t.save(function (err) {
                if (err) {
                    console.log("Error!!!");
                } else {
                    console.log("Tema insertado con exito!!");
                    res.send({ "id": t.id });
                }
            });
        }
    });
});
app.put("/juego/:idJuego/bloque/:idBloque/tema/:idTema", function (req, res, next) {
    //Solo se puede actualizar el nombre
    var idUsuario = jwt.decode(req.header("Authorization"), 'shhhhh').id;
    var Query = Juego.all({ where: { id: req.params.idJuego } }, function (err, juego) {
        if (juego[0].id_usuario == idUsuario) {
            Tema.update({ where: { id: req.params.idTema } }, { nombre: req.body.nombre }, function (err, imagen) { });
            var preguntas = req.body.nuevasPreguntas;
            var i = 0;
            if (preguntas != undefined) {
                async.during(function (callback) {
                    return callback(null, i < preguntas.length);
                }, function (callback) {
                    //Guardar preguntas
                    var p;
                    if (preguntas[i].tipo == "test") {
                        p = new Pregunta({
                            nivel: preguntas[i].nivel, tipo: preguntas[i].tipo, enunciado: preguntas[i].enunciado,
                            resA: preguntas[i].resA, resB: preguntas[i].resB, resC: preguntas[i].resC, resD: preguntas[i].resD,
                            solucion: preguntas[i].solucion, Tema_id: req.params.idTema
                        });
                    } else if (preguntas[i].tipo == "problema") {
                        p = new Pregunta({
                            nivel: preguntas[i].nivel, tipo: preguntas[i].tipo, enunciado: preguntas[i].enunciado,
                            correccion: preguntas[i].correccion, pista: preguntas[i].pista,
                            solucion: preguntas[i].solucion, Tema_id: req.params.idTema
                        });
                    }
                    p.isValid(function (valid) {
                        if (valid) {
                            p.save(function (err) {
                                if (!err) {
                                    i++;
                                    callback();
                                }
                            });
                        }
                    });
                }, function (err) {
                    //OK
                    res.json({ "OK": "Tema actualizado" });
                });
            } else {
                res.json({ "OK": "Tema actualizado" });
            }
        }
    });
});
app.get("/juego/bloque/:idBloque/tema", function (req, res, next) {
    var Query = Tema.all();
    Query.where("Bloque_id", req.params.idBloque);
    Query.run({}, function (err, temas) {
        var temasObjeto = {};
        temasObjeto.temas = temas;
        res.json(temasObjeto);
    });
});
app.post("/juego/bloque/tema/pregunta", function (req, res) {
    //De momento solo cojo los valores que no son obligatorios
    //Tendria que hacer alguna clase de condicion para saber que me viene y que no    
    var numeroCampos = Object.keys(req.body).length;
    var p;
    if (req.body.pregunta.tipo == "test") {
        p = new Pregunta({
            nivel: req.body.pregunta.nivel, tipo: req.body.pregunta.tipo, enunciado: req.body.pregunta.enunciado,
            resA: req.body.pregunta.resA, resB: req.body.pregunta.resB, resC: req.body.pregunta.resC, resD: req.body.pregunta.resD,
            solucion: req.body.pregunta.solucion, Tema_id: req.body.idTema
        });
    } else if (req.body.pregunta.tipo == "problema") {
        p = new Pregunta({
            nivel: req.body.pregunta.nivel, tipo: req.body.pregunta.tipo, enunciado: req.body.pregunta.enunciado,
            correccion: req.body.pregunta.correccion, pista: req.body.pregunta.pista,
            solucion: req.body.pregunta.solucion, Tema_id: req.body.idTema
        });
    }
    /*if (numeroCampos == 6) {
        p = new Pregunta({
            nivel: req.body.nivel, tipo: req.body.tipo, enunciado: req.body.enunciado,
            solucion: req.body.solucion, correccion: req.body.correccion, Tema_id: req.body.idTema
        });
    }*/
    p.isValid(function (valid) {
        if (!valid) {
            console.log(p.errors); // hash of errors {attr: [errmessage, errmessage, ...], attr: ...}
        } else {
            p.save(function (err) {
                if (err) {
                    console.log("Error!!!");
                } else {
                    console.log("Pregunta insertado con exito!!");
                    res.json({ "id": p.id });
                }
            });
        }
    });
});
app.put("/juego/:idJuego/bloque/:idBloque/tema/:idTema/pregunta/:idPregunta", function (req, res, next) {
    //Solo se puede actualizar el nombre
    var idUsuario = jwt.decode(req.header("Authorization"), 'shhhhh').id;
    var Query = Juego.all({ where: { id: req.params.idJuego } }, function (err, juego) {
        if (juego[0].id_usuario == idUsuario) {
            if (req.body.pregunta.tipo == "test") {
                Pregunta.update({ where: { id: req.params.idPregunta } }, {
                    nivel: req.body.pregunta.nivel, tipo: req.body.pregunta.tipo, enunciado: req.body.pregunta.enunciado,
                    resA: req.body.pregunta.resA, resB: req.body.pregunta.resB, resC: req.body.pregunta.resC, resD: req.body.pregunta.resD,
                    solucion: req.body.pregunta.solucion
                }, function (err, imagen) {
                    if (!err) {
                        res.json({ "OK": "Pregunta actualizada" });
                    }
                });
            } else if (req.body.pregunta.tipo == "problema") {
                Pregunta.update({ where: { id: req.params.idPregunta } }, {
                    nivel: req.body.pregunta.nivel, tipo: req.body.pregunta.tipo, enunciado: req.body.pregunta.enunciado,
                    correccion: req.body.pregunta.correccion, pista: req.body.pregunta.pista,
                    solucion: req.body.pregunta.solucion
                }, function (err, imagen) {
                    if (!err) {
                        res.json({ "OK": "Pregunta actualizada" });
                    }
                });
            }
        }
    });
});

app.post("/imagen/pregunta/:id", function (req, res, next) {
    var form = new formidable.IncomingForm();
    function getPath(req, callback) {
        form.parse(req, function (err, fields, files) {
            var oldpath = files.imagen.path;
            var extensionPartes = files.imagen.name.split(".");
            var extension = extensionPartes[extensionPartes.length - 1];
            //var newpath = './imagenes/juegos/' + +"."+extension;
            callback(oldpath, extension);
        });
    }
    getPath(req, function (oldpath, extension) {
        var newpath = './imagenes/preguntas/' + req.params.id + "." + extension;
        fs.rename(oldpath, newpath, function (err) {
            if (err) throw err;
            Pregunta.update({ where: { id: req.params.id } }, { imagen: req.params.id + "." + extension }, function (err, imagen) { });
        });
    });
});
app.get("/juego/bloque/tema/:idTema/pregunta", function (req, res, next) {
    var Query = Pregunta.all();
    Query.where("Tema_id", req.params.idTema);
    Query.run({}, function (err, preguntas) {
        var preguntasObjeto = {};
        preguntasObjeto.preguntas = preguntas;
        console.log(preguntasObjeto);
        res.json(preguntasObjeto);
    });
});
app.get("/juego/bloque/tema/:idTema/pregunta/:tipo/niveles", function (req, res, next) {
    console.log(">>>" + req.params.idTema);
    Pregunta.all({ where: { Tema_id: req.params.idTema, tipo: req.params.tipo }, order: "nivel asc" }, function (err, count) {
        var nivel = 1;
        var niveles = 0;
        for (var i = 0; i < count.length; i++) {
            if (count[i].nivel == 1 && niveles == 0) {
                niveles++;
            }
            if (count[i].nivel != nivel) {
                nivel = count[i].nivel;
                niveles++;
            }
        }
        console.log(">>>" + niveles);
        res.json({ "niveles": niveles });
    });
});
app.get("/imagen/pregunta/:id", function (req, res, next) {
    fs.readFile("./imagenes/preguntas/" + req.params.id, function (err, content) {
        if (err) {
            /*fs.readFile("./imagenes/noImagen.png", function (err, content) {
                res.writeHead(200, { 'Content-type': 'image/jpg' });
                res.end(content);
            });*/
        } else {
            res.writeHead(200, { 'Content-type': 'image/jpg' });
            res.end(content);
        }
    });
});
app.post("/partida", function (req, res, next) {
    var partida = new Partida({ nombre: req.body.nombre, id_juego: req.body.idJuego });
    partida.isValid(function (valid) {
        if (!valid) {
            console.log(partida.errors); // hash of errors {attr: [errmessage, errmessage, ...], attr: ...}
        } else {
            partida.save(function (err) {
                if (err) {
                    console.log("Error!!!");
                } else {
                    console.log("Partida insertada con exito!!");
                    res.send({ "id": partida.id });
                }
            });
        }
    });
});
app.get("/partida/:idPartida/info/juego/", function (req, res, next) {
    var Query = Partida.all();
    Query.where("id", req.params.idPartida);
    Query.run({}, function (err, partida) {
        res.json({ "idJuego": partida[0].id_juego });
    });
});
app.get("/partida/:idPartida/info/bloque/", function (req, res) {
    var idUsuario = jwt.decode(req.header("Authorization"), 'shhhhh').id;
    async.waterfall([function (callback) {
        Progreso_Partida.all({ where: { id_jugador: idUsuario, id_partida: req.params.idPartida } }, function (err, progreso) {
            var idTema = progreso[0].id_tema;
            callback(null, idTema);
        });
    }, function (idTema, callback) {
        Tema.all({ where: { id: idTema } }, function (err, tema) {
            callback(null, tema[0].Bloque_id);
        });
    }], function (err, bloque) {
        res.json({ "BloqueActual": bloque });
    });
});
app.get("/partida/:idPartida/info/", function (req, res, next) {
    async.waterfall([function (callback) {
        var Query = Partida.all();
        Query.where("id", req.params.idPartida);
        Query.run({}, function (err, partida) {
            callback(null, partida[0].id_juego);
        });
    }, function (idJuego, callback) {
        var Query2 = Bloque.all();
        Query2.where("Juego_id", idJuego);
        Query2.run({}, function (err, bloques) {
            callback(null, bloques);
        });
    }, function (bloques, callback) {
        var temas = [];
        var count = 0;
        var max = bloques.length;
        async.during(function (callback) {
            return callback(null, count < max);
        }, function (callback) {
            var Query3 = Tema.all();
            Query3.where("Bloque_id", bloques[count].id);
            Query3.run({}, function (err, tema) {
                temas.push(tema[0]);
                count++;
                callback();
            });
        }, function (err) {
            callback(null, temas, bloques);
        });
    }, function (temas, bloques, callback) {
        var preguntas = [];
        var count = 0;
        var max = temas.length;
        async.during(function (callback) {
            return callback(null, count < max);
        }, function (callback) {
            var Query4 = Pregunta.all();
            Query4.where("Tema_id", temas[count].id);
            Query4.run({}, function (err, p) {
                preguntas.push(p[0]);
                count++;
                callback();
            });
        }, function (err) {
            callback(null, preguntas, temas, bloques);
        });
    }], function (err, preguntas, temas, bloques) {
        res.json({ "bloques": bloques, "temas": temas, "preguntas": preguntas });
    });
});
app.get("/partida/usuario/:idUsuario", function (req, res, next) {
    async.waterfall([function (callback) {
        var Query = Usuario_Partida.all();
        Query.where("id_usuario", req.params.idUsuario);
        Query.run({}, function (err, partidas) {
            callback(null, partidas);
        });
    }, function (partidasJugador, callback) {
        var partidas = [];
        var count = 0;
        var max = partidasJugador.length;
        async.during(function (callback) {
            return callback(null, count < max);
        }, function (callback) {
            var Query2 = Partida.all();
            Query2.where("id", partidasJugador[count].id_partida);
            Query2.run({}, function (err, partida) {
                partidas.push(partida[0]);
                count++;
                callback();
            });
        }, function (err) {
            callback(null, partidas);
        });
    }, function (partidas, callback) {
        var partidasDevolver = [];
        var count = 0;
        var max = partidas.length;
        async.during(function (callback) {
            return callback(null, count < max);
        }, function (callback) {
            var Query3 = Juego.all();
            Query3.where("id", partidas[count].id_juego);
            Query3.run({}, function (err, juego) {
                var obj = {};
                obj.nombre = partidas[count].nombre;
                obj.id = partidas[count].id;
                obj.id_juego = juego[0].id;
                obj.imagen = juego[0].imagen;
                partidasDevolver.push(obj);
                count++;
                callback();
            });
        }, function (err) {
            callback(null, partidasDevolver);
        });
    }], function (err, results) {
        res.json({ "partidas": results });
    });
});

app.post("/partida/usuario", function (req, res, next) {
    var Query = Usuario.all();
    Query.where("nombre", req.body.nombreUsuario);
    var idUsuario = undefined;
    Query.run({}, function (err, usuario) {
        idUsuario = usuario[0].id;
        var up = new Usuario_Partida({ id_usuario: idUsuario, id_partida: req.body.idPartida });
        up.isValid(function (valid) {
            if (!valid) {
                console.log(up.errors); // hash of errors {attr: [errmessage, errmessage, ...], attr: ...}
            } else {
                up.save(function (err) {
                    if (err) {
                        console.log("Error!!!");
                    } else {
                        console.log("Usuario añadido con exito!!");
                        getPrimerTemaDeJuego(up.id_partida, function (idTema) {
                            getTipoDePregunta(idTema, function (tipo) {
                                var progreso = new Progreso_Partida({ id_jugador: up.id_usuario, id_partida: up.id_partida, nivel: 1, tipo: tipo, id_tema: idTema, id_pregunta_anterior: 0, terminado: 0 });
                                progreso.isValid(function (valid) {
                                    if (!valid) {
                                        console.log(progreso.errors); // hash of errors {attr: [errmessage, errmessage, ...], attr: ...}
                                    } else {
                                        progreso.save(function (err) {
                                            if (err) {
                                                console.log("Error!!!");
                                            } else {
                                                console.log("Ok");
                                            }
                                        });
                                    }
                                });
                                res.send({ "id_usuario": up.id_usuario, "id_partida": up.id_partida });
                            });
                        });
                    }
                });
            }
        });
    });
});
function getTipoDePregunta(idTema, callback) {
    Pregunta.all({ where: { "Tema_id": idTema, "nivel": 1 } }, function (err, preguntas) {
        callback(preguntas[0].tipo)
    });
}
function getPrimerTemaDeJuego(idPartida, callback) {
    var Query = Partida.all();
    Query.where("id", idPartida);
    Query.run({}, function (err, partida) {
        var idJuego = partida[0].id_juego;
        var Query2 = Bloque.all();
        Query2.where("Juego_id", idJuego);
        Query2.run({}, function (err, bloques) {
            var idBloque = bloques[0].id;
            var Query3 = Tema.all();
            Query3.where("Bloque_id", idBloque);
            Query3.run({}, function (err, temas) {
                var idTema = temas[0].id;
                callback(idTema);
                /*var Query4 = Pregunta.all();
                Query4.where("Tema_id", idTema);
                Query4.run({}, function (err, preguntas) {
                    var idPregunta = preguntas[0].id;
                    callback(idPregunta);
                });*/
            });
        });
    });
}
function getPrimerTemaDeBloque(idBloque, callback) {
    Tema.all({ where: { Bloque_id: idBloque } }, function (err, temas) {
        callback(temas[0].id);
    });
}
function comprobarSiguienteTema(idTema, callback) {
    Tema.all({ where: { id: idTema } }, function (err, tema) {
        var bloque = tema[0].Bloque_id;
        Tema.all({ where: { Bloque_id: bloque, id: { gt: idTema } } }, function (err, temas) {
            if (temas.length > 0) {
                callback(temas[0].id);
            } else {
                callback(false);
                //Cambio de bloque
            }
        });
    });
}
function comprobarSiguienteBloque(idTema, callback) {
    Tema.all({ where: { id: idTema } }, function (err, tema) {
        var idBloque = tema[0].Bloque_id;
        Bloque.all({ where: { id: idBloque } }, function (err, bloque) {
            var idJuego = bloque[0].Juego_id;
            Bloque.all({ where: { Juego_id: idJuego, id: { gt: idBloque } } }, function (err, bloques) {
                if (bloques.length > 0) {
                    callback(bloques[0].id);
                } else {
                    callback(false);
                }
            });
        })
    });
}
function comprobarCambioDeTema(idTema, nivel, callback) {
    Pregunta.all({ where: { Tema_id: idTema, nivel: parseInt(nivel) + 1, tipo: "problema" } }, function (err, preguntas) {
        if (preguntas.length > 0) {
            callback(false);
        } else {
            callback(true);
        }
    });
}
function comprobarSiProblemas(idTema, callback) {
    Pregunta.all({ where: { Tema_id: idTema, tipo: "problema" } }, function (err, preguntas) {
        if (preguntas.length > 0) {
            console.log("Tengo problemas");
            callback(true);
        } else {
            callback(false);
        }
    });
}
function comprobarSiTest(idTema, nivel, callback) {
    Pregunta.all({ where: { Tema_id: idTema, tipo: "test", nivel: parseInt(nivel) + 1 } }, function (err, preguntas) {
        if (preguntas.length > 0) {
            console.log("Tengo tests");
            callback(true);
        } else {
            callback(false);
        }
    });
}
app.post("/pregunta/correccion", function (req, res, next) {
    var idUsuario = jwt.decode(req.header("Authorization"), 'shhhhh').id;
    var idPartida = req.body.id_partida;
    var tipo = req.body.tipo;
    var nivel = req.body.nivel;
    var Query = Pregunta.findOne();
    Query.where("id", req.body.idPregunta);
    Query.run({}, function (err, pregunta) {
        if (pregunta.tipo == "problema") {
            if (req.body.respuesta === pregunta.solucion) {
                comprobarCambioDeTema(pregunta.Tema_id, nivel, function (cambio) {
                    if (!cambio) {
                        Progreso_Partida.update({ where: { id_partida: idPartida, id_jugador: idUsuario } },
                            { nivel: parseInt(nivel) + 1, tipo: "problema", id_tema: pregunta.Tema_id, id_pregunta_anterior: pregunta.id }, function (err, imagen) { });
                        res.json("Respuesta correcta");
                    } else {
                        comprobarSiguienteTema(pregunta.Tema_id, function (id) {
                            if (id == false) {
                                comprobarSiguienteBloque(pregunta.Tema_id, function (id) {
                                    if (id == false) {
                                        Progreso_Partida.update({ where: { id_partida: idPartida, id_jugador: idUsuario } },
                                            { terminado: 1 }, function (err, imagen) { });
                                        res.json("Se acabó el juego");
                                    } else {
                                        getPrimerTemaDeBloque(id, function (id) {
                                            console.log("Deberia cambiar de tema");
                                            getTipoDePregunta(id, function (tipo) {
                                                Progreso_Partida.update({ where: { id_partida: idPartida, id_jugador: idUsuario } },
                                                    { nivel: 1, tipo: tipo, id_tema: id, id_pregunta_anterior: 0 }, function (err, imagen) { });
                                                res.json("Respuesta correcta");
                                            });
                                        });
                                    }
                                });
                            } else {
                                Progreso_Partida.update({ where: { id_partida: idPartida, id_jugador: idUsuario } },
                                    { nivel: parseInt(nivel) + 1, tipo: "problema", id_tema: id, id_pregunta_anterior: pregunta.id }, function (err, imagen) { });
                                res.json("Respuesta correcta");
                            }
                        });
                    }
                });
            } else {
                res.json("Respuesta incorrecta," + pregunta.correccion);
            }
        } else {
            if (req.body.respuesta === pregunta.solucion) {
                comprobarSiTest(pregunta.Tema_id, nivel, function (hay) {
                    if (hay) {
                        Progreso_Partida.update({ where: { id_partida: idPartida, id_jugador: idUsuario } },
                            { nivel: parseInt(nivel) + 1, tipo: "test", tema: pregunta.Tema_id, id_pregunta_anterior: pregunta.id }, function (err, imagen) { });
                        res.json("Respuesta correcta");
                    } else {
                        comprobarSiProblemas(pregunta.Tema_id, function (hay) {
                            if (hay) {
                                Progreso_Partida.update({ where: { id_partida: idPartida, id_jugador: idUsuario } },
                                    { nivel: 1, tipo: "problema", id_tema: pregunta.Tema_id, id_pregunta_anterior: pregunta.id }, function (err, imagen) { });
                                res.json("Respuesta correcta");
                            } else {
                                comprobarSiguienteTema(pregunta.Tema_id, function (id) {
                                    if (id == false) {
                                        comprobarSiguienteBloque(pregunta.Tema_id, function (id) {
                                            if (id == false) {
                                                Progreso_Partida.update({ where: { id_partida: idPartida, id_jugador: idUsuario } },
                                                    { terminado: 1 }, function (err, imagen) { });
                                                res.json("Se acabó el juego");
                                            } else {
                                                getPrimerTemaDeBloque(id, function (id) {
                                                    Progreso_Partida.update({ where: { id_partida: idPartida, id_jugador: idUsuario } },
                                                        { nivel: 1, tipo: "test", id_tema: id, id_pregunta_anterior: 0 }, function (err, imagen) { });
                                                    res.json("Respuesta correcta");
                                                });
                                            }
                                        });
                                    } else {
                                        Progreso_Partida.update({ where: { id_partida: idPartida, id_jugador: idUsuario } },
                                            { nivel: 1, tipo: "test", id_tema: id, id_pregunta_anterior: pregunta.id }, function (err, imagen) { });
                                        res.json("Respuesta correcta");
                                    }
                                });
                            }
                        });
                    }
                });
                /*if (nivel == 2) {//Comprobar si hay mas tests
                    comprobarSiProblemas(pregunta.Tema_id, function (hay) {
                        if (hay) {
                            Progreso_Partida.update({ where: { id_partida: idPartida, id_jugador: idUsuario } },
                                { nivel: 1, tipo: "problema", id_tema: pregunta.Tema_id, id_pregunta_anterior: pregunta.id }, function (err, imagen) { });
                            res.json("Respuesta correcta");
                        } else {
                            comprobarSiguienteTema(pregunta.Tema_id, function (id) {
                                if (id == false) {
                                    comprobarSiguienteBloque(pregunta.Tema_id, function (id) {
                                        if (id == false) {
                                            Progreso_Partida.update({ where: { id_partida: idPartida, id_jugador: idUsuario } },
                                                { terminado: 1 }, function (err, imagen) { });
                                            res.json("Se acabó el juego");
                                        } else {
                                            getPrimerTemaDeBloque(id, function (id) {
                                                Progreso_Partida.update({ where: { id_partida: idPartida, id_jugador: idUsuario } },
                                                    { nivel: 1, tipo: "test", id_tema: id, id_pregunta_anterior: 0 }, function (err, imagen) { });
                                                res.json("Respuesta correcta");
                                            });
                                        }
                                    });
                                } else {
                                    Progreso_Partida.update({ where: { id_partida: idPartida, id_jugador: idUsuario } },
                                        { nivel: 1, tipo: "test", id_tema: id, id_pregunta_anterior: pregunta.id }, function (err, imagen) { });
                                    res.json("Respuesta correcta");
                                }
                            });
                        }
                    });
                } else {
                    Progreso_Partida.update({ where: { id_partida: idPartida, id_jugador: idUsuario } },
                        { nivel: 2, tipo: "test", tema: pregunta.Tema_id, id_pregunta_anterior: pregunta.id }, function (err, imagen) { });
                    res.json("Respuesta correcta");
                }*/
            } else {
                Progreso_Partida.update({ where: { id_partida: idPartida, id_jugador: idUsuario } },
                    { nivel: nivel, tipo: "test", tema: pregunta.Tema_id, id_pregunta_anterior: pregunta.id }, function (err, imagen) { });
                res.json("Respuesta incorrecta");
            }
        }
    });
});

app.get("/pregunta/siguiente/:idPartida", function (req, res) {
    var idUsuario = jwt.decode(req.header("Authorization"), 'shhhhh').id;
    //var Query = Progreso_Partida.all();
    //Query.where("id_partida", req.params.idPartida);
    Progreso_Partida.all({ where: { id_partida: req.params.idPartida, id_jugador: idUsuario } }, function (err, progreso) {
        //for (var i = 0; i < progreso.length; i++) {
        //if (progreso[i].id_jugador == idUsuario) {
        if (progreso[0].terminado == 1) {
            res.json("Ya se ha acabado el juego");
        } else {
            var nivel = progreso[0].nivel;
            var tipo = progreso[0].tipo;
            var tema = progreso[0].id_tema;
            var id_pregunta = progreso[0].id_pregunta_anterior;
            /*var Query2 = Pregunta.all();
            Query2.where("Tema_id", tema);
            Query2.gt('id', id_pregunta);*/
            Pregunta.all({ where: { "Tema_id": tema, "tipo": tipo, "nivel": nivel, "id": { "gt": id_pregunta } } }, function (err, preguntas) {
                //for (var j = 0; j < preguntas.length; j++) {
                //if (preguntas[j].nivel == nivel) {
                //if (preguntas[j].tipo == tipo) {                        
                res.json({ "pregunta": preguntas[0] })
                // return;                                
                // }
                //}
                //}
                //res.end();
            });
            //}
            //}
        }
    });
});

function obtenerBloquesDeJugador(idPartida, callback) {
    async.waterfall([function (callback) {
        Progreso_Partida.all({ where: { id_partida: idPartida } }, function (err, progresos) {
            callback(null, progresos);
        });
    }, function (progresos, callback) {
        var bloques = [];
        var count = 0;
        var max = progresos.length;
        async.during(function (callback) {
            return callback(null, count < max);
        }, function (callback) {
            var idTema = progresos[count].id_tema;
            var idJugador = progresos[count].id_jugador;
            Tema.all({ where: { id: idTema } }, function (err, tema) {
                var idBloque = tema[0].Bloque_id;
                var o = {};
                Usuario.all({ where: { id: idJugador } }, function (err, jugador) {
                    o.jugador = jugador[0].nombre;
                    o.bloque = idBloque;
                    bloques.push(o);
                    count++;
                    callback();
                });
            });
        }, function (err) {
            callback(null, bloques);
        });
    }], function (err, results) {
        callback(results);
    });
}
function obtenerTemasDeJugador(idPartida, callback) {
    async.waterfall([function (callback) {
        Progreso_Partida.all({ where: { id_partida: idPartida } }, function (err, progresos) {
            callback(null, progresos);
        });
    }, function (progresos, callback) {
        var temas = [];
        var count = 0;
        var max = progresos.length;
        async.during(function (callback) {
            return callback(null, count < max);
        }, function (callback) {
            var idTema = progresos[count].id_tema;
            var idJugador = progresos[count].id_jugador;
            Usuario.all({ where: { id: idJugador } }, function (err, jugador) {
                var o = {};
                o.jugador = jugador[0].nombre;
                o.tema = idTema;
                temas.push(o);
                count++;
                callback();
            });
        }, function (err) {
            callback(null, temas);
        });
    }], function (err, results) {
        callback(results);
    });
}
function obtenerPreguntasDeJugador(idPartida, callback) {
    async.waterfall([function (callback) {
        Progreso_Partida.all({ where: { id_partida: idPartida } }, function (err, progresos) {
            callback(null, progresos);
        });
    }, function (progresos, callback) {
        var preguntas = [];
        var count = 0;
        var max = progresos.length;
        async.during(function (callback) {
            return callback(null, count < max);
        }, function (callback) {
            var tipo = progresos[count].tipo;
            var nivel = progresos[count].nivel;
            var tema = progresos[count].id_tema;
            var idJugador = progresos[count].id_jugador;
            Usuario.all({ where: { id: idJugador } }, function (err, jugador) {
                var o = {};
                o.jugador = jugador[0].nombre;
                o.tipo = tipo;
                o.nivel = nivel;
                o.tema = tema;
                preguntas.push(o);
                count++;
                callback();
            });
        }, function (err) {
            callback(null, preguntas);
        });
    }], function (err, results) {
        callback(results);
    });
}
app.get("/partida/:idPartida/posicion/:tipoTablero/", function (req, res) {
    if (req.params.tipoTablero == "bloque") {
        obtenerBloquesDeJugador(req.params.idPartida, function (bloques) {
            console.log(bloques);
            res.json(bloques);
        });
    } else if (req.params.tipoTablero == "tema") {
        obtenerTemasDeJugador(req.params.idPartida, function (bloques) {
            res.json(bloques);
        });
    } else if (req.params.tipoTablero == "pregunta") {
        obtenerPreguntasDeJugador(req.params.idPartida, function (bloques) {
            res.json(bloques);
        });
    }
});
function encryptPassword(password, callback) {
    var cipher = crypto.createCipher(algorithm, salt)
    var crypted = cipher.update(password, 'utf8', 'hex')
    crypted += cipher.final('hex');
    callback(crypted);
}

app.listen(3001);