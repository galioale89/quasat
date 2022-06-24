const Mongoose = require("mongoose")
const Schema = Mongoose.Schema

const Agenda = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'usuario',
        require: false
    },    
    pessoa: {
        type: Schema.Types.ObjectId,
        ref: 'pessoa',
        require: false
    },      
    cliente: {
        type: Schema.Types.ObjectId,
        ref: 'cliente',
        require: false
    },    
    data: {
        type: String,
        require: false
    },
    datafim: {
        type: String,
        require: false
    },
    descricao: {
        type: String,
        require: false
    }
})

Mongoose.model("agenda", Agenda)
