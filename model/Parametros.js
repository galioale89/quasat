const Mongoose = require("mongoose")
const Schema = Mongoose.Schema

const Parametros = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'usuario',
        require: false
    },   
    descricao: {
        type: String,
        require: false
    },
    opcao: {
        type: String,
        require: false
    },
    tipo: {
        type: String,
        require: false
    },
    valor: {
        type: String,
        require: false
    }
})

Mongoose.model("parametros", Parametros)
