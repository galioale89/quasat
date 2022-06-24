const mongoose = require('mongoose')
const Schema = mongoose.Schema

const Pedido = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'usuario',
        require: false,
    },
    vlrServico: {
        type: Number,
        require: false
    },
    vlrKit: {
        type: Number,
        require: false
    },
    vlrTotal: {
        type: Number,
        require: false
    },
    pagamento: {
        type: String,
        require: false
    },
    potencia: {
        type: Number,
        require: false
    },
    plaQtdMod: {
        type: Number,
        require: false
    },
    plaWattMod: {
        type: String,
        require: false
    },
    plaQtdInv: {
        type: Number,
        require: false
    },
    plaKwpInv: {
        type: String,
        require: false
    },
    telhado: {
        type: String,
        require: false
    },
    orientacao: {
        type: String,
        require: false
    },
    pagador: {
        type: String,
        require: false
    }, 
    obs:{
        type: String,
        require: false
    },
    prazo:{
        type: Number,
        require: false
    },
    descuc:{
        type: String,
        require: false
    },
    descug:{
        type: String,
        require: false
    },
    data:{
        type: String,
        require: false
    }    
})

mongoose.model('pedido', Pedido)