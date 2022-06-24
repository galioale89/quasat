const Mongoose = require("mongoose")
const Schema = Mongoose.Schema

const Mensagem = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'usuario',
        require: false
    },   
    descricao: {
        type: String,
        require: false
    }
})

Mongoose.model("mensagem", Mensagem)
