const mongoose = require('mongoose')
const Schema = mongoose.Schema

const ListaMateriais = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'usuario',
        require: false,
    },
    descricao: {
        type: String,
        require: false,
    },
})

mongoose.model('listaMateriais', ListaMateriais)